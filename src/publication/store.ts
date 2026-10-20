import type { Kysely } from "kysely";
import type { Database } from "../db/types.js";
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

export const createPublicationJob = (
	_lease: PublicationLease,
	_request: PublicationStart,
): Promise<PublicationJob> => {
	throw new Error("Not implemented: createPublicationJob");
};

export const updatePublicationStage = (
	_lease: PublicationLease,
	_jobId: string,
	_stage: PublicationStage,
): Promise<void> => {
	throw new Error("Not implemented: updatePublicationStage");
};

export const capturePublicationRevision = (
	_lease: PublicationLease,
	_jobId: string,
	_revision: PublicationRevision,
): Promise<void> => {
	throw new Error("Not implemented: capturePublicationRevision");
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
