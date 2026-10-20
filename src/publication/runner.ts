import path from "node:path";
import type { Kysely } from "kysely";
import {
	type ArchiveDocuments,
	loadArchiveDocuments,
	writeArchiveDocuments,
} from "../db/export-archive.js";
import type { Database } from "../db/types.js";
import {
	commitAndPushPublication,
	type PublicationGitContext,
	reconcilePublicationGit,
	synchronizePublicationCheckout,
	validatePublicationCheckout,
} from "./git.js";
import {
	acquirePublicationLease,
	appendPublicationLog,
	capturePublicationRevision,
	completePublicationJob,
	interruptAbandonedPublications,
	type PublicationLease,
	readPublicationJobRecord,
	recordPublicationCommit,
	reservePublicationJob,
	sanitizePublicationLog,
	updatePublicationStage,
} from "./store.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationRevision,
	PublicationStart,
} from "./types.js";
/** Revision and documents must come from the same repeatable-read transaction. */
export type PublicationSnapshot = {
	revision: PublicationRevision;
	documents: ArchiveDocuments;
};
export type PublicationRunner = {
	start: (request: PublicationStart) => Promise<PublicationJob>;
	close: () => Promise<void>;
};

export const readPublicationSnapshot = (
	database: Kysely<Database>,
): Promise<PublicationSnapshot> =>
	database
		.transaction()
		.setIsolationLevel("repeatable read")
		.setAccessMode("read only")
		.execute(async (transaction) => {
			const { revision } = await transaction
				.selectFrom("archive_publication_state")
				.select("revision")
				.where("id", "=", 1)
				.executeTakeFirstOrThrow();
			const documents = await loadArchiveDocuments(transaction, {
				log: () => {},
			});
			return { revision, documents };
		});

/**
 * Lease → validate/reconcile Git → fast-forward → snapshot → writeArchiveDocuments
 * → generated-path commit/push → acknowledge captured revision and complete.
 * Persist failures without acknowledging; release the lease on every exit.
 * Recovery may finish an earlier push before exporting the newly captured state.
 */
export const executePublicationJob = async (
	lease: PublicationLease,
	config: PublicationConfig,
	job: PublicationJob,
	previousJob: PublicationJob | undefined,
): Promise<void> => {
	const secrets = Object.entries(process.env)
		.filter(
			([name, value]) =>
				/password|secret|token|private_key/i.test(name) && value,
		)
		.map(([, value]) => value)
		.filter((value): value is string => value !== undefined);
	const log = (message: string) =>
		appendPublicationLog(lease, job.id, message, secrets);
	const context: PublicationGitContext = {
		config,
		job,
		log,
		updateStage: (stage) => updatePublicationStage(lease, job.id, stage),
		recordCommit: async (commitId) => {
			await recordPublicationCommit(lease, job.id, commitId);
			context.job = { ...context.job, commitId };
		},
	};
	try {
		await context.updateStage("validating");
		await validatePublicationCheckout(context);
		const recovery = await reconcilePublicationGit(context, previousJob);
		let revision: PublicationRevision;
		if (recovery.kind !== "ready") {
			if (previousJob?.revision === undefined)
				throw new Error("Interrupted publication has no captured revision");
			revision = previousJob.revision;
			await capturePublicationRevision(lease, job.id, revision);
			context.job = { ...context.job, revision };
			await log(
				"Retry reconciles the previous snapshot; newer archive edits remain pending",
			);
		} else {
			await context.updateStage("synchronizing");
			await synchronizePublicationCheckout(context);
			await context.updateStage("exporting");
			const snapshot = await readPublicationSnapshot(lease.database);
			revision = snapshot.revision;
			await capturePublicationRevision(lease, job.id, revision);
			context.job = { ...context.job, revision };
			const exportLogs: string[] = [];
			try {
				await writeArchiveDocuments(
					snapshot.documents,
					path.join(config.checkoutPath, "src/res"),
					path.join(config.checkoutPath, "public/assets"),
					{
						log: (message) => {
							exportLogs.push(message);
						},
					},
				);
			} finally {
				if (exportLogs.length > 0) await log(exportLogs.join("\n"));
			}
		}
		const result = await commitAndPushPublication(context, recovery);
		await context.updateStage("acknowledging");
		await log(
			result.kind === "pushed"
				? "Publication succeeded: pushed to GitHub; deployment runs separately"
				: "Publication succeeded: no generated changes",
		);
		await completePublicationJob(lease, job.id, {
			outcome: result.kind === "pushed" ? "succeeded" : "no-change",
			acknowledgedRevision: revision,
			...(result.kind === "pushed" ? { commitId: result.commitId } : {}),
		});
	} catch (error) {
		const summary =
			sanitizePublicationLog({
				message: error instanceof Error ? error.message : "Publication failed",
				secrets,
			})
				.join(" ")
				.slice(0, 1000) || "Publication failed";
		try {
			await log(`Publication failed: ${summary}`);
		} finally {
			await completePublicationJob(lease, job.id, {
				outcome: "failed",
				error: summary,
			});
		}
	}
};

/** Initialize interruption recovery; start returns once the queued job is durable. */
export const createPublicationRunner = async (
	database: Kysely<Database>,
	config: PublicationConfig,
): Promise<PublicationRunner> => {
	if (config.enabled) {
		const lease = await acquirePublicationLease(database);
		if (lease !== undefined) {
			try {
				await interruptAbandonedPublications(lease);
			} finally {
				await lease.release();
			}
		}
	}
	let closing = false;
	const work = new Set<Promise<void>>();
	let persistenceFailed = false;
	const starts = new Set<Promise<PublicationJob>>();
	const begin = async (request: PublicationStart): Promise<PublicationJob> => {
		if (closing) throw new Error("Publication runner is closing");
		const { lease, job } = await reservePublicationJob({
			database,
			request,
			config,
		});
		let previousJob: PublicationJob | undefined;
		try {
			previousJob =
				request.retryJobId === undefined
					? undefined
					: await readPublicationJobRecord(lease.database, request.retryJobId);
			if (closing) throw new Error("Publication runner is closing");
		} catch (error) {
			try {
				await completePublicationJob(lease, job.id, {
					outcome: closing ? "interrupted" : "failed",
					error: closing
						? "Publication interrupted during shutdown. Retry explicitly."
						: "Unable to load publication retry metadata",
				});
			} finally {
				await lease.release();
			}
			throw error;
		}
		const task = executePublicationJob(lease, config, job, previousJob)
			.finally(() => lease.release())
			.catch(() => {
				persistenceFailed = true;
				console.error(
					"Publication job persistence or lease cleanup failed; startup recovery may be required",
				);
			})
			.finally(() => {
				work.delete(task);
			});
		work.add(task);
		return job;
	};
	return {
		start: (request) => {
			const attempt = begin(request);
			starts.add(attempt);
			void attempt
				.finally(() => {
					starts.delete(attempt);
				})
				.catch(() => {});
			return attempt;
		},
		close: async () => {
			closing = true;
			await Promise.allSettled([...starts]);
			await Promise.all([...work]);
			if (persistenceFailed)
				throw new Error("Publication job persistence or lease cleanup failed");
		},
	};
};
