import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Kysely } from "kysely";
import {
	type ArchiveDocuments,
	loadArchiveDocuments,
	writeArchiveDocuments,
} from "../db/export-archive.js";
import type { Database } from "../db/types.js";
import { validatePublicationDestination } from "./checkout.js";
import {
	commitAndPushPublication,
	type PublicationGitContext,
	type PublicationGitResult,
	reconcilePublicationGit,
	synchronizePublicationCheckout,
	validatePublicationCheckout,
} from "./git/index.js";
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
import { readPublicationTarget, samePublicationTarget } from "./target.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationRevision,
	PublicationStart,
	RemotePublicationConfig,
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

type PublicationExecution = {
	lease: PublicationLease;
	config: PublicationConfig;
	job: PublicationJob;
	secrets: string[];
	log: (message: string) => Promise<void>;
	updateStage: (stage: PublicationJob["stage"]) => Promise<void>;
};

const createPublicationExecution = (
	lease: PublicationLease,
	config: PublicationConfig,
	job: PublicationJob,
): PublicationExecution => {
	const secrets = Object.entries(process.env)
		.filter(
			([name, value]) =>
				/password|secret|token|private_key/i.test(name) && value,
		)
		.map(([, value]) => value)
		.filter((value): value is string => value !== undefined);
	return {
		lease,
		config,
		job,
		secrets,
		log: (message) => appendPublicationLog(lease, job.id, message, secrets),
		updateStage: (stage) => updatePublicationStage(lease, job.id, stage),
	};
};

const verifyPublicationTarget = async ({
	config,
	job,
}: PublicationExecution): Promise<void> => {
	if (!samePublicationTarget(await readPublicationTarget(config), job.target))
		throw new Error(
			"Publication destination or branch changed; start publication for the current target",
		);
};

const validateLocalDestination = async (
	execution: PublicationExecution,
): Promise<void> => {
	await validatePublicationDestination({
		checkoutPath: execution.config.checkoutPath,
		repositoryRoot: fileURLToPath(new URL("../../", import.meta.url)),
	});
	await execution.log(
		"Validated local destination; Git metadata inspection only, no fetch or push",
	);
};

/** Read documents and their revision together, then durably capture that revision. */
const generatePublicationAssets = async (
	execution: PublicationExecution,
): Promise<PublicationSnapshot> => {
	await execution.updateStage("exporting");
	const snapshot = await readPublicationSnapshot(execution.lease.database);
	await capturePublicationRevision(
		execution.lease,
		execution.job.id,
		snapshot.revision,
	);
	return snapshot;
};

/** Flush exporter progress even when a filesystem write fails partway through. */
const savePublicationExport = async (
	execution: PublicationExecution,
	snapshot: PublicationSnapshot,
): Promise<void> => {
	const logs: string[] = [];
	try {
		await writeArchiveDocuments(
			snapshot.documents,
			path.join(execution.config.checkoutPath, "src/res"),
			path.join(execution.config.checkoutPath, "public/assets"),
			{
				log: (message) => {
					logs.push(message);
				},
			},
		);
	} finally {
		if (logs.length) await execution.log(logs.join("\n"));
	}
};

const createGitContext = (
	execution: PublicationExecution,
	config: RemotePublicationConfig,
): PublicationGitContext => {
	const context: PublicationGitContext = {
		config,
		job: execution.job,
		log: execution.log,
		updateStage: execution.updateStage,
		recordCommit: async (commitId) => {
			await recordPublicationCommit(
				execution.lease,
				execution.job.id,
				commitId,
			);
			context.job = { ...context.job, commitId };
		},
	};
	return context;
};

/** Retry a recognized remote snapshot without acknowledging newer archive edits. */
const captureRecoveredRevision = async (
	execution: PublicationExecution,
	previousJob: PublicationJob | undefined,
): Promise<PublicationRevision> => {
	if (previousJob?.revision === undefined)
		throw new Error("Interrupted publication has no captured revision");
	await capturePublicationRevision(
		execution.lease,
		execution.job.id,
		previousJob.revision,
	);
	await execution.log(
		"Retry reconciles the previous snapshot; newer archive edits remain pending",
	);
	return previousJob.revision;
};

/** Persist acknowledgement and completion together only after the chosen flow succeeds. */
const acknowledgePublication = async (
	execution: PublicationExecution,
	revision: PublicationRevision,
	result: PublicationGitResult | { kind: "local" },
): Promise<void> => {
	await execution.updateStage("acknowledging");
	const message =
		result.kind === "local"
			? "wrote generated assets to the local checkout"
			: result.kind === "pushed"
				? "pushed to GitHub; deployment runs separately"
				: "no generated changes";
	await execution.log(`Publication succeeded: ${message}`);
	await completePublicationJob(execution.lease, execution.job.id, {
		outcome: result.kind === "no-change" ? "no-change" : "succeeded",
		acknowledgedRevision: revision,
		...(result.kind === "pushed" ? { commitId: result.commitId } : {}),
	});
};

const recordPublicationFailure = async (
	execution: PublicationExecution,
	error: unknown,
): Promise<void> => {
	const summary =
		sanitizePublicationLog({
			message: error instanceof Error ? error.message : "Publication failed",
			secrets: execution.secrets,
		})
			.join(" ")
			.slice(0, 1000) || "Publication failed";
	try {
		await execution.log(`Publication failed: ${summary}`);
	} finally {
		await completePublicationJob(execution.lease, execution.job.id, {
			outcome: "failed",
			error: summary,
		});
	}
};

/** The runner owns the lease; each mode lists its execution steps in order. */
export const executePublicationJob = async (
	lease: PublicationLease,
	config: PublicationConfig,
	job: PublicationJob,
	previousJob: PublicationJob | undefined,
): Promise<void> => {
	const execution = createPublicationExecution(lease, config, job);
	try {
		await execution.updateStage("validating");
		await verifyPublicationTarget(execution);
		switch (config.mode) {
			case "local": {
				// A local retry exports anew to repair any partially written files.
				await validateLocalDestination(execution);
				const snapshot = await generatePublicationAssets(execution);
				await savePublicationExport(execution, snapshot);
				await verifyPublicationTarget(execution);
				await acknowledgePublication(execution, snapshot.revision, {
					kind: "local",
				});
				break;
			}
			case "remote": {
				const git = createGitContext(execution, config);
				// Validate the checkout and origin before any remote contact.
				await validatePublicationCheckout(git);
				const recovery = await reconcilePublicationGit(git, previousJob);
				let revision: PublicationRevision;
				if (recovery.kind === "ready") {
					await execution.updateStage("synchronizing");
					await synchronizePublicationCheckout(git);
					const snapshot = await generatePublicationAssets(execution);
					await savePublicationExport(execution, snapshot);
					revision = snapshot.revision;
				} else {
					revision = await captureRecoveredRevision(execution, previousJob);
				}
				git.job = { ...git.job, revision };
				const result = await commitAndPushPublication(git, recovery);
				await acknowledgePublication(execution, revision, result);
				break;
			}
		}
	} catch (error) {
		await recordPublicationFailure(execution, error);
	}
};

/** Initialize interruption recovery; start returns once the queued job is durable. */
export const createPublicationRunner = async (
	database: Kysely<Database>,
	config: PublicationConfig,
): Promise<PublicationRunner> => {
	{
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
