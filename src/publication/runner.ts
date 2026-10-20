import type { Kysely } from "kysely";
import type { ArchiveDocuments } from "../db/export-archive.js";
import type { Database } from "../db/types.js";
import type { PublicationLease } from "./store.js";
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
	_database: Kysely<Database>,
): Promise<PublicationSnapshot> => {
	throw new Error("Not implemented: readPublicationSnapshot");
};

/**
 * Lease → validate/reconcile Git → fast-forward → snapshot → writeArchiveDocuments
 * → generated-path commit/push → acknowledge captured revision and complete.
 * Persist failures without acknowledging; release the lease on every exit.
 * Recovery may finish an earlier push before exporting the newly captured state.
 */
export const executePublicationJob = (
	_lease: PublicationLease,
	_config: PublicationConfig,
	_job: PublicationJob,
	_previousJob: PublicationJob | undefined,
): Promise<void> => {
	throw new Error("Not implemented: executePublicationJob");
};

export const createPublicationRunner = (
	_database: Kysely<Database>,
	_config: PublicationConfig,
): Promise<PublicationRunner> => {
	throw new Error("Not implemented: createPublicationRunner");
};
