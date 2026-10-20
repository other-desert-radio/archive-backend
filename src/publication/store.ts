import type { Kysely, Selectable } from "kysely";
import { isMatching, P } from "ts-pattern";
import type { ArchivePublicationJobsTable, Database } from "../db/types.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationJobDetail,
	PublicationOutcome,
	PublicationRevision,
	PublicationStage,
	PublicationStart,
	PublicationStatus,
} from "./types.js";
/** Dedicated connection owns the session advisory lock until release. */
export type PublicationLease = {
	database: Kysely<Database>;
	release: () => Promise<void>;
};
/** Acknowledgement is permitted only after confirmed push or verified no-change. */
export type PublicationCompletion = {
	outcome: PublicationOutcome;
	commitId?: string;
	error?: string;
	acknowledgedRevision?: PublicationRevision;
};

const publicationJob = (
	row: Selectable<ArchivePublicationJobsTable>,
): PublicationJob => {
	const base = {
		id: row.id,
		requestedBy: row.requested_by,
		createdAt: row.created_at.toISOString(),
		target: {
			repository: row.repository,
			checkoutPath: row.checkout_path,
			branch: row.branch,
		},
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

export const readPublicationStatus = (
	_database: Kysely<Database>,
	_config: PublicationConfig,
): Promise<PublicationStatus> => {
	throw new Error("Not implemented: readPublicationStatus");
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
	_database: Kysely<Database>,
): Promise<PublicationLease | undefined> => {
	throw new Error("Not implemented: acquirePublicationLease");
};

/** Caller will own the publication lease; admission/retry checks are a later unit. */
export const createPublicationJob = async ({
	lease,
	request,
	config,
}: {
	lease: PublicationLease;
	request: PublicationStart;
	config: PublicationConfig;
}): Promise<PublicationJob> => {
	const row = await lease.database
		.insertInto("archive_publication_jobs")
		.values({
			id: crypto.randomUUID(),
			requested_by: request.requestedBy,
			repository: config.repository,
			checkout_path: config.checkoutPath,
			branch: config.branch,
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
 * Delete completed jobs beyond the newest 20, ordered by completed_at, created_at,
 * then ID descending. Preserve every running job. The log foreign key cascades
 * deletes. Return the deleted job count; database failures propagate.
 * Completion orchestration will call this helper in its own transaction later.
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
		.offset(20);
	const result = await lease.database
		.deleteFrom("archive_publication_jobs")
		.where("outcome", "!=", "running")
		.where("id", "in", obsolete)
		.executeTakeFirstOrThrow();
	return Number(result.numDeletedRows);
};

/** Atomically complete/acknowledge and retain the latest 20 completed jobs. */
export const completePublicationJob = (
	_lease: PublicationLease,
	_jobId: string,
	_completion: PublicationCompletion,
): Promise<void> => {
	throw new Error("Not implemented: completePublicationJob");
};

export const interruptAbandonedPublications = (
	_lease: PublicationLease,
): Promise<void> => {
	throw new Error("Not implemented: interruptAbandonedPublications");
};

import { stripVTControlCharacters } from "node:util";
