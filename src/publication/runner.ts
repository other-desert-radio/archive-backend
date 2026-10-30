import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Kysely } from "kysely";
import {
	allocateArchiveVersions,
	type DatasetVersions,
	withArchiveExportLock,
} from "../db/archive-versions.js";
import { writeArchiveDocuments } from "../db/export-archive.js";
import type { Database } from "../db/types.js";
import { validatePublicationDestination } from "./checkout.js";
import {
	commitAndPushPublication,
	inspectGit,
	type PublicationGitContext,
	type PublicationGitResult,
	reconcilePublicationGit,
	synchronizePublicationCheckout,
	validatePublicationCheckout,
} from "./git/index.js";
import { snapshotLocalPublicationFiles } from "./local-preview.js";
import {
	createPublicationPreviews,
	type PreparedPublication,
} from "./preview.js";
import {
	acquirePublicationLease,
	appendPublicationLog,
	capturePublicationRevision,
	captureRecoveredPublication,
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
	PublicationPreview,
	PublicationRevision,
	PublicationStart,
	RemotePublicationConfig,
} from "./types.js";

export { readPublicationSnapshot } from "./snapshot.js";

import {
	loadPublicationSnapshot,
	type PublicationSnapshot,
} from "./snapshot.js";

export type { PublicationSnapshot } from "./snapshot.js";
export type PublicationRunner = {
	start: (request: PublicationStart) => Promise<PublicationJob>;
	preparePreview: (request: PublicationStart) => Promise<PublicationPreview>;
	close: () => Promise<void>;
};

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

/** Allocate the captured or explicitly reviewed snapshot under the shared exporter lock. */
const generatePublicationAssets = async (
	execution: PublicationExecution,
	reviewed?: PublicationSnapshot,
): Promise<PublicationSnapshot & { versions: DatasetVersions }> => {
	await execution.updateStage("exporting");
	const snapshot = await allocateArchiveVersions(
		execution.lease.database,
		async (transaction) => {
			const snapshot = reviewed ?? (await loadPublicationSnapshot(transaction));
			await capturePublicationRevision(
				{ ...execution.lease, database: transaction },
				execution.job.id,
				snapshot.revision,
			);
			return snapshot;
		},
		execution.job.id,
	);
	await execution.log(
		`Captured archive revision ${snapshot.revision}; dataset versions: shows ${snapshot.versions.shows.id}, DJs ${snapshot.versions.djs.id}, tags ${snapshot.versions.tags.id}`,
	);
	return snapshot;
};

/** Flush exporter progress even when a filesystem write fails partway through. */
const savePublicationExport = async (
	execution: PublicationExecution,
	snapshot: PublicationSnapshot & { versions: DatasetVersions },
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
			snapshot.versions,
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
	const versions = await captureRecoveredPublication(
		execution.lease,
		execution.job.id,
		previousJob.id,
	);
	await execution.log(`Recovering archive revision ${previousJob.revision}`);
	await execution.log(
		versions
			? `Recovered dataset versions: shows ${versions.shows.id}, DJs ${versions.djs.id}, tags ${versions.tags.id}; newer archive edits remain pending`
			: "Dataset versions unavailable for legacy publication; newer archive edits remain pending",
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
	prepared?: PreparedPublication,
): Promise<void> => {
	const execution = createPublicationExecution(lease, config, job);
	try {
		// The publication lease already pins this session; standalone exports share this lock.
		await withArchiveExportLock(lease.database, async (database) => {
			// Use this handle while the outer connection callback owns the lease provider.
			const execution = createPublicationExecution(
				{ ...lease, database },
				config,
				job,
			);
			await execution.updateStage("validating");
			await verifyPublicationTarget(execution);
			switch (config.mode) {
				case "local": {
					// A local retry exports anew to repair any partially written files.
					await validateLocalDestination(execution);
					let revision: string;
					if (prepared) {
						if (
							(await snapshotLocalPublicationFiles(config.checkoutPath)) !==
							prepared.localFingerprint
						)
							throw new Error(
								"Local archive files changed after preview. Refresh preview before retrying",
							);
						if (!prepared.preview.revision)
							throw new Error("Prepared publication has no revision");
						revision = prepared.preview.revision;
						if (!prepared.documents)
							throw new Error("Prepared publication documents are unavailable");
						await savePublicationExport(
							execution,
							await generatePublicationAssets(execution, {
								revision,
								documents: prepared.documents,
							}),
						);
						await execution.log(
							"Installed the reviewed publication snapshot in the local checkout",
						);
					} else {
						const snapshot = await generatePublicationAssets(execution);
						await savePublicationExport(execution, snapshot);
						revision = snapshot.revision;
					}
					await verifyPublicationTarget(execution);
					await acknowledgePublication(execution, revision, {
						kind: "local",
					});
					break;
				}
				case "remote": {
					const git = createGitContext(execution, config);
					// Validate the checkout and origin before any remote contact.
					await validatePublicationCheckout(git);
					const recovery = await reconcilePublicationGit(git, previousJob);
					if (
						prepared &&
						(recovery.kind !== prepared.recovery?.kind ||
							(recovery.kind !== "ready" &&
								prepared.recovery?.kind !== "ready" &&
								recovery.commitId !== prepared.recovery?.commitId))
					)
						throw new Error(
							"Publication recovery changed after preview. Refresh preview before retrying",
						);
					let revision: PublicationRevision;
					if (recovery.kind === "ready") {
						await execution.updateStage("synchronizing");
						await synchronizePublicationCheckout(git);
						if (prepared) {
							if (
								(await inspectGit(config.checkoutPath, [
									"rev-parse",
									"HEAD",
								])) !== prepared.baseline?.commit
							)
								throw new Error(
									"Target branch changed after preview. Refresh preview before retrying",
								);
							if (!prepared.preview.revision)
								throw new Error("Prepared publication has no revision");
							if (!prepared.documents)
								throw new Error(
									"Prepared publication documents are unavailable",
								);
							await savePublicationExport(
								execution,
								await generatePublicationAssets(execution, {
									revision: prepared.preview.revision,
									documents: prepared.documents,
								}),
							);
							await execution.log(
								"Installed the reviewed publication snapshot",
							);
							revision = prepared.preview.revision;
						} else {
							const snapshot = await generatePublicationAssets(execution);
							await savePublicationExport(execution, snapshot);
							revision = snapshot.revision;
						}
					} else {
						revision = await captureRecoveredRevision(execution, previousJob);
					}
					git.job = { ...git.job, revision };
					const result = await commitAndPushPublication(git, recovery);
					await acknowledgePublication(execution, revision, result);
					break;
				}
			}
		});
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
	const previews = createPublicationPreviews(database, config);
	let closing = false;
	const work = new Set<Promise<void>>();
	let persistenceFailed = false;
	const starts = new Set<Promise<PublicationJob>>();
	const begin = async (request: PublicationStart): Promise<PublicationJob> => {
		if (closing) throw new Error("Publication runner is closing");
		let prepared: PreparedPublication | undefined;
		const reserve = async () => {
			try {
				return await reservePublicationJob({
					database,
					request,
					config,
					validate: async (lease) => {
						prepared = await previews.validate(request, lease);
					},
				});
			} catch (error) {
				if (prepared) prepared.inUse = false;
				throw error;
			}
		};
		const { lease, job } = await reserve();
		if (prepared) prepared.inUse = true;
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
			if (prepared) await previews.remove(prepared);
			throw error;
		}
		const task = executePublicationJob(
			lease,
			config,
			job,
			previousJob,
			prepared,
		)
			.finally(async () => {
				try {
					if (prepared) await previews.remove(prepared);
				} finally {
					await lease.release();
				}
			})
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
		preparePreview: previews.prepare,
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
			await previews.close();
			if (persistenceFailed)
				throw new Error("Publication job persistence or lease cleanup failed");
		},
	};
};
