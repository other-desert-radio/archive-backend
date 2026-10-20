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

/** Read job metadata independently of the later log-detail reader. */
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

export const readPublicationJob = (
	_database: Kysely<Database>,
	_jobId: string,
): Promise<PublicationJobDetail | undefined> => {
	throw new Error("Not implemented: readPublicationJob");
};

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

/** Sanitize before persistence; retain at most 2,000 lines including a truncation notice. */
export const appendPublicationLog = (
	_lease: PublicationLease,
	_jobId: string,
	_message: string,
): Promise<void> => {
	throw new Error("Not implemented: appendPublicationLog");
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
