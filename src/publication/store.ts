import {
	type ExpressionBuilder,
	type Kysely,
	type Selectable,
	sql,
} from "kysely";
import { isMatching, P } from "ts-pattern";
import type { ArchivePublicationJobsTable, Database } from "../db/types.js";
import { readPublicationTarget, samePublicationTarget } from "./target.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationJobDetail,
	PublicationOutcome,
	PublicationRevision,
	PublicationStage,
	PublicationStart,
	PublicationStatus,
	PublicationTarget,
} from "./types.js";

const activePublicationLeases = new WeakSet<PublicationLease>();
/** Dedicated connection owns the session advisory lock until release. */
export type PublicationLease = {
	/** Use only until release; never retain or query this handle after releasing it. */
	database: Kysely<Database>;
	release: () => Promise<void>;
};

// Two-key advisory-lock namespace: ASCII "ARCH", publication lock 1.
const publicationLockNamespace = 1095910216;
const publicationLockId = 1;

/** Keep each destination's retry history separate while sharing one execution lock. */
const matchesPublicationTarget = (
	eb: ExpressionBuilder<Database, "archive_publication_jobs">,
	target: PublicationTarget,
) =>
	eb.and([
		eb("mode", "=", target.mode),
		eb("checkout_path", "=", target.checkoutPath),
		target.repository === undefined
			? eb("repository", "is", null)
			: eb("repository", "=", target.repository),
		target.branch === undefined
			? eb("branch", "is", null)
			: eb("branch", "=", target.branch),
	]);
/** Acknowledge only after successful local export, confirmed push, or no-change. */
export type PublicationCompletion = {
	outcome: PublicationOutcome;
	commitId?: string;
	error?: string;
	acknowledgedRevision?: PublicationRevision;
};

const publicationJob = (
	row: Selectable<ArchivePublicationJobsTable>,
): PublicationJob => {
	let target: PublicationTarget;
	if (row.mode === "local") {
		target = {
			mode: "local",
			checkoutPath: row.checkout_path,
			...(row.repository === null ? {} : { repository: row.repository }),
			...(row.branch === null ? {} : { branch: row.branch }),
		};
	} else {
		if (row.repository === null || row.branch === null)
			throw new Error("Remote publication job has incomplete target metadata");
		target = {
			mode: "remote",
			checkoutPath: row.checkout_path,
			repository: row.repository,
			branch: row.branch,
		};
	}
	const base = {
		id: row.id,
		requestedBy: row.requested_by,
		createdAt: row.created_at.toISOString(),
		target,
		stage: row.stage,
		...(row.retry_job_id === null ? {} : { retryJobId: row.retry_job_id }),
		...(row.revision === null ? {} : { revision: row.revision }),
		...(row.commit_id === null ? {} : { commitId: row.commit_id }),
	};
	if (row.outcome === "running") return { ...base, outcome: "running" };
	if (row.completed_at === null)
		throw new Error("Completed publication job has no completion timestamp");
	return {
		...base,
		outcome: row.outcome,
		completedAt: row.completed_at.toISOString(),
		...(row.error === null ? {} : { error: row.error }),
	};
};

/** Read job metadata without loading its logs. */
export const readPublicationJobRecord = async (
	database: Kysely<Database>,
	jobId: string,
): Promise<PublicationJob | undefined> => {
	const row = await database
		.selectFrom("archive_publication_jobs")
		.selectAll()
		.where("id", "=", jobId)
		.executeTakeFirst();
	return row === undefined ? undefined : publicationJob(row);
};

export const readPublicationStatus = async (
	database: Kysely<Database>,
	config: PublicationConfig,
): Promise<PublicationStatus> => {
	const target = await readPublicationTarget(config);
	return database
		.transaction()
		.setIsolationLevel("repeatable read")
		.setAccessMode("read only")
		.execute(async (transaction) => {
			const state = await transaction
				.selectFrom("archive_publication_state")
				.select(["revision", "published_revision", "published_target"])
				.where("id", "=", 1)
				.executeTakeFirstOrThrow();
			const row = await transaction
				.selectFrom("archive_publication_jobs")
				.selectAll()
				.where((eb) =>
					eb.or([
						eb("outcome", "=", "running"),
						matchesPublicationTarget(eb, target),
					]),
				)
				.orderBy("created_at", "desc")
				.orderBy("id", "desc")
				.limit(1)
				.executeTakeFirst();
			const latest = row === undefined ? undefined : publicationJob(row);
			// A running job blocks every target. Terminal history for another
			// destination must not force the current target into a retry loop.
			const latestJob =
				latest &&
				(latest.outcome === "running" ||
					samePublicationTarget(latest.target, target))
					? latest
					: undefined;
			return {
				mode: config.mode,
				target,
				revision: state.revision,
				publishedRevision: state.published_revision,
				pending:
					state.published_target === null ||
					!samePublicationTarget(state.published_target, target) ||
					BigInt(state.revision) > BigInt(state.published_revision),
				...(latestJob ? { latestJob } : {}),
			};
		});
};

/**
 * Read metadata and ordered logs from one snapshot. Missing jobs return undefined;
 * database failures propagate. A sequence-0 notice sets logsTruncated.
 */
export const readPublicationJob = (
	database: Kysely<Database>,
	jobId: string,
): Promise<PublicationJobDetail | undefined> =>
	database
		.transaction()
		.setIsolationLevel("repeatable read")
		.setAccessMode("read only")
		.execute(async (transaction) => {
			const job = await readPublicationJobRecord(transaction, jobId);
			if (job === undefined) return undefined;
			const logs = await transaction
				.selectFrom("archive_publication_logs")
				.select(["sequence", "created_at", "message"])
				.where("job_id", "=", jobId)
				.orderBy("sequence")
				.execute();
			return {
				job,
				logs: logs.map((row) => ({
					sequence: row.sequence,
					timestamp: row.created_at.toISOString(),
					message: row.message,
				})),
				logsTruncated: logs.some((row) => row.sequence === 0),
			};
		});

/** Return undefined when busy; keep the lock on one dedicated connection. */
export const acquirePublicationLease = (
	database: Kysely<Database>,
): Promise<PublicationLease | undefined> =>
	new Promise((resolve, reject) => {
		if (database.isTransaction) {
			reject(
				new Error(
					"Publication leases require a database outside a transaction",
				),
			);
			return;
		}
		// The connection callback stays open until release, outside any transaction.
		const connectionTask = database.connection().execute(async (connection) => {
			const result = await sql<{
				acquired: boolean;
			}>`SELECT pg_try_advisory_lock(${publicationLockNamespace}, ${publicationLockId}) AS acquired`.execute(
				connection,
			);
			if (result.rows[0]?.acquired !== true) {
				resolve(undefined);
				return;
			}
			await new Promise<void>((finish) => {
				const lease: PublicationLease = {
					database: connection,
					release: async () => {
						activePublicationLeases.delete(lease);
						finish();
						await connectionTask;
					},
				};
				activePublicationLeases.add(lease);
				resolve(lease);
			});
			const unlocked = await sql<{
				released: boolean;
			}>`SELECT pg_advisory_unlock(${publicationLockNamespace}, ${publicationLockId}) AS released`.execute(
				connection,
			);
			if (unlocked.rows[0]?.released !== true)
				throw new Error("Publication advisory lock was lost");
		});
		// Acquisition errors reject the caller; release awaits cleanup errors directly.
		void connectionTask.catch(reject);
	});

export class PublicationBusyError extends Error {
	constructor() {
		super("Another publication is running or awaiting interruption recovery");
		this.name = "PublicationBusyError";
	}
}

export class PublicationRequestError extends Error {
	constructor(
		message: string,
		readonly statusCode: 400 | 409 | 503,
	) {
		super(message);
		this.name = "PublicationRequestError";
	}
}

/** Reserve durably under the publisher lock; caller must release in finally. */
export const reservePublicationJob = async ({
	database,
	request,
	config,
	validate,
}: {
	database: Kysely<Database>;
	request: PublicationStart;
	config: PublicationConfig;
	validate?: ((lease: PublicationLease) => Promise<void>) | undefined;
}): Promise<{ lease: PublicationLease; job: PublicationJob }> => {
	const lease = await acquirePublicationLease(database);
	if (lease === undefined) throw new PublicationBusyError();
	try {
		const running = await lease.database
			.selectFrom("archive_publication_jobs")
			.select("id")
			.where("outcome", "=", "running")
			.limit(1)
			.executeTakeFirst();
		if (running !== undefined) throw new PublicationBusyError();
		const target = await readPublicationTarget(config);
		const latest = await lease.database
			.selectFrom("archive_publication_jobs")
			.selectAll()
			.where((eb) => matchesPublicationTarget(eb, target))
			.orderBy("created_at", "desc")
			.orderBy("id", "desc")
			.limit(1)
			.executeTakeFirst();
		if (request.retryJobId !== undefined) {
			const requested = await readPublicationJobRecord(
				lease.database,
				request.retryJobId,
			);
			if (requested && !samePublicationTarget(requested.target, target))
				throw new PublicationRequestError(
					"Retry target differs from the interrupted publication",
					409,
				);
			if (
				latest?.id !== request.retryJobId ||
				(latest.outcome !== "failed" && latest.outcome !== "interrupted")
			)
				throw new PublicationRequestError(
					"Retry must identify the latest failed or interrupted publication",
					409,
				);
		} else if (
			latest !== undefined &&
			samePublicationTarget(publicationJob(latest).target, target) &&
			(latest.outcome === "failed" || latest.outcome === "interrupted")
		) {
			throw new PublicationRequestError(
				"Explicit Retry is required for the latest publication",
				409,
			);
		}
		await validate?.(lease);
		const job = await createPublicationJob({ lease, request, config, target });
		return { lease, job };
	} catch (error) {
		await lease.release();
		throw error;
	}
};

/** Low-level insert; runner admission must use reservePublicationJob instead. */
export const createPublicationJob = async ({
	lease,
	request,
	config,
	target: savedTarget,
}: {
	lease: PublicationLease;
	request: PublicationStart;
	config: PublicationConfig;
	target?: PublicationTarget;
}): Promise<PublicationJob> => {
	const target = savedTarget ?? (await readPublicationTarget(config));
	const row = await lease.database
		.insertInto("archive_publication_jobs")
		.values({
			id: crypto.randomUUID(),
			requested_by: request.requestedBy,
			mode: target.mode,
			repository: target.repository ?? null,
			checkout_path: target.checkoutPath,
			branch: target.branch ?? null,
			retry_job_id: request.retryJobId ?? null,
			completed_at: null,
			revision: null,
			commit_id: null,
			error: null,
		})
		.returningAll()
		.executeTakeFirstOrThrow();
	return publicationJob(row);
};

export const updatePublicationStage = async (
	lease: PublicationLease,
	jobId: string,
	stage: PublicationStage,
): Promise<void> => {
	await lease.database
		.updateTable("archive_publication_jobs")
		.set({ stage })
		.where("id", "=", jobId)
		.where("outcome", "=", "running")
		.returning("id")
		.executeTakeFirstOrThrow();
};

export const capturePublicationRevision = async (
	lease: PublicationLease,
	jobId: string,
	revision: PublicationRevision,
): Promise<void> => {
	if (!isMatching(P.string.regex(/^[1-9][0-9]*$/), revision))
		throw new Error("Publication revision must be a positive decimal string");
	await lease.database
		.updateTable("archive_publication_jobs")
		.set({ revision })
		.where("id", "=", jobId)
		.where("outcome", "=", "running")
		.where("revision", "is", null)
		.returning("id")
		.executeTakeFirstOrThrow();
};

/** Reuse the committed snapshot's metadata without reallocating against newer archive data. */
export const captureRecoveredPublication = async (
	lease: PublicationLease,
	jobId: string,
	previousJobId: string,
): Promise<void> => {
	await lease.database.transaction().execute(async (transaction) => {
		const previous = await transaction
			.selectFrom("archive_publication_jobs")
			.select(["revision", "dataset_versions"])
			.where("id", "=", previousJobId)
			.executeTakeFirstOrThrow();
		if (previous.revision === null)
			throw new Error("Interrupted publication has no captured revision");
		await capturePublicationRevision(
			{ ...lease, database: transaction },
			jobId,
			previous.revision,
		);
		// Legacy jobs have no dataset snapshot; recovery must still work for their commits.
		await transaction
			.updateTable("archive_publication_jobs")
			.set({
				dataset_versions:
					previous.dataset_versions === null
						? null
						: JSON.stringify(previous.dataset_versions),
			})
			.where("id", "=", jobId)
			.where("outcome", "=", "running")
			.returning("id")
			.executeTakeFirstOrThrow();
	});
};

/** Persist the identified publisher commit before attempting a push. */
export const recordPublicationCommit = async (
	lease: PublicationLease,
	jobId: string,
	commitId: string,
): Promise<void> => {
	if (!isMatching(P.string.regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/), commitId))
		throw new Error("Publication commit must be a full Git object identifier");
	await lease.database
		.updateTable("archive_publication_jobs")
		.set({ commit_id: commitId })
		.where("id", "=", jobId)
		.where("outcome", "=", "running")
		.where("revision", "is not", null)
		.where("commit_id", "is", null)
		.returning("id")
		.executeTakeFirstOrThrow();
};

export type PublicationLogInput = {
	message: string;
	/** Known deployment secrets to redact in addition to recognized credential forms. */
	secrets?: readonly string[];
};

/** Normalize lines and strip terminal controls; redact credentials before storage. */
export const sanitizePublicationLog = ({
	message,
	secrets = [],
}: PublicationLogInput): string[] => {
	let text = message;
	// Redact complete values before normalization, then again without terminal controls.
	for (const secret of secrets
		.filter((value) => value.length > 0)
		.sort((a, b) => b.length - a.length))
		text = text.replaceAll(secret, "[REDACTED]");
	const normalize = (value: string) =>
		Array.from(stripVTControlCharacters(value))
			.filter((character) => {
				const code = character.charCodeAt(0);
				return (
					code === 9 ||
					code === 10 ||
					code === 13 ||
					(code >= 32 && code !== 127 && (code < 128 || code > 159))
				);
			})
			.join("")
			.replace(/\r\n?/g, "\n");
	text = normalize(text);
	for (const secret of secrets
		.map(normalize)
		.filter((value) => value.length > 0)
		.sort((a, b) => b.length - a.length))
		text = text.replaceAll(secret, "[REDACTED]");
	text = text
		.replace(
			/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
			"[REDACTED PRIVATE KEY]",
		)
		.replace(/((?:https?|ssh):\/\/)[^\s/@]+@/gi, "$1[REDACTED]@")
		.replace(
			/((?:authorization|password|passwd|token|access_token|refresh_token|api_key|secret)\s*[:=]\s*)(?:bearer\s+|basic\s+)?(?:"[^"\n]*"|'[^'\n]*'|[^\s&,;]+)/gi,
			"$1[REDACTED]",
		)
		.replace(
			/\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b/g,
			"[REDACTED]",
		);
	return text.split("\n").filter((line) => line.trim().length > 0);
};

/**
 * Sanitize, then append transactionally under a per-job row lock, allocating
 * increasing sequences. Keep at most 2,000 lines: on overflow keep one durable
 * sequence-0 notice and the newest 1,999 lines. Reject missing/completed jobs.
 * Known secrets must be supplied by the caller; never persist raw command output.
 */
export const appendPublicationLog = async (
	lease: PublicationLease,
	jobId: string,
	message: string,
	secrets?: readonly string[],
): Promise<void> => {
	const lines = sanitizePublicationLog({
		message,
		...(secrets === undefined ? {} : { secrets }),
	});
	await lease.database.transaction().execute(async (transaction) => {
		await transaction
			.selectFrom("archive_publication_jobs")
			.select("id")
			.where("id", "=", jobId)
			.where("outcome", "=", "running")
			.forUpdate()
			.executeTakeFirstOrThrow();
		if (lines.length === 0) return;
		const previous = await transaction
			.selectFrom("archive_publication_logs")
			.select("sequence")
			.where("job_id", "=", jobId)
			.orderBy("sequence", "desc")
			.limit(1)
			.executeTakeFirst();
		const last = previous?.sequence ?? 0;
		const truncated = last + lines.length > 2000;
		const retained = truncated ? lines.slice(-1999) : lines;
		const first = last + lines.length - retained.length + 1;
		await transaction
			.insertInto("archive_publication_logs")
			.values(
				retained.map((line, index) => ({
					job_id: jobId,
					sequence: first + index,
					message: line,
				})),
			)
			.execute();
		if (truncated) {
			await transaction
				.deleteFrom("archive_publication_logs")
				.where("job_id", "=", jobId)
				.where("sequence", ">", 0)
				.where("sequence", "<=", last + lines.length - 1999)
				.execute();
			await transaction
				.insertInto("archive_publication_logs")
				.values({
					job_id: jobId,
					sequence: 0,
					message:
						"Earlier log lines were truncated; showing the latest 1,999 lines.",
				})
				.onConflict((conflict) =>
					conflict.columns(["job_id", "sequence"]).doNothing(),
				)
				.execute();
		}
	});
};

/**
 * Delete completed jobs beyond the newest 10, ordered by completed_at, created_at,
 * then ID descending. Preserve every running job. The log foreign key cascades
 * deletes. Return the deleted job count; database failures propagate.
 */
export const pruneCompletedPublicationJobs = async (
	lease: PublicationLease,
): Promise<number> => {
	const obsolete = lease.database
		.selectFrom("archive_publication_jobs")
		.select("id")
		.where("outcome", "!=", "running")
		.orderBy("completed_at", "desc")
		.orderBy("created_at", "desc")
		.orderBy("id", "desc")
		.offset(10);
	const result = await lease.database
		.deleteFrom("archive_publication_jobs")
		.where("outcome", "!=", "running")
		.where("id", "in", obsolete)
		.executeTakeFirstOrThrow();
	return Number(result.numDeletedRows);
};

/** Atomically complete/acknowledge and retain the latest 10 completed jobs. */
export const completePublicationJob = async (
	lease: PublicationLease,
	jobId: string,
	completion: PublicationCompletion,
): Promise<void> => {
	const successful =
		completion.outcome === "succeeded" || completion.outcome === "no-change";
	if (
		successful !== (completion.acknowledgedRevision !== undefined) ||
		(successful && completion.error !== undefined)
	)
		throw new Error("Invalid publication completion acknowledgement");
	await lease.database.transaction().execute(async (transaction) => {
		const job = await transaction
			.selectFrom("archive_publication_jobs")
			.selectAll()
			.where("id", "=", jobId)
			.where("outcome", "=", "running")
			.forUpdate()
			.executeTakeFirstOrThrow();
		if (
			completion.commitId !== undefined &&
			completion.commitId !== job.commit_id
		)
			throw new Error(
				"Completion commit differs from the recorded publication commit",
			);
		if (successful) {
			if (
				job.revision === null ||
				job.revision !== completion.acknowledgedRevision
			)
				throw new Error(
					"Only the captured publication revision can be acknowledged",
				);
			await transaction
				.updateTable("archive_publication_state")
				.set({
					published_revision: job.revision,
					published_target: publicationJob(job).target,
				})
				.where("id", "=", 1)
				.where("revision", ">=", job.revision)
				.returning("id")
				.executeTakeFirstOrThrow();
		}
		await transaction
			.updateTable("archive_publication_jobs")
			.set({
				outcome: completion.outcome,
				completed_at: sql`CURRENT_TIMESTAMP`,
				error: completion.error ?? null,
			})
			.where("id", "=", jobId)
			.execute();
		await pruneCompletedPublicationJobs({ ...lease, database: transaction });
	});
};

/** Run under a fresh startup lease before admitting work; never retry automatically. */
export const interruptAbandonedPublications = async (
	lease: PublicationLease,
): Promise<void> => {
	if (!activePublicationLeases.has(lease))
		throw new Error(
			"Interruption recovery requires an active publication lease",
		);
	await lease.database.transaction().execute(async (transaction) => {
		if (!activePublicationLeases.has(lease))
			throw new Error(
				"Publication lease was released before interruption recovery",
			);
		await transaction
			.updateTable("archive_publication_jobs")
			.set({
				outcome: "interrupted",
				completed_at: sql`CURRENT_TIMESTAMP`,
				error: "Publication interrupted by backend restart. Retry explicitly.",
			})
			.where("outcome", "=", "running")
			.execute();
		await pruneCompletedPublicationJobs({ ...lease, database: transaction });
	});
};

import { stripVTControlCharacters } from "node:util";
