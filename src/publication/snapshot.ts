import type { Kysely, Transaction } from "kysely";
import {
	type ArchiveDocuments,
	loadArchiveDocuments,
} from "../db/export-archive.js";
import type { Database } from "../db/types.js";
import type { PublicationRevision } from "./types.js";

export type PublicationSnapshot = {
	revision: PublicationRevision;
	documents: ArchiveDocuments;
};

/** Load through the caller's transaction, including version allocation transactions. */
export const loadPublicationSnapshot = async (
	transaction: Transaction<Database>,
): Promise<PublicationSnapshot> => {
	const { revision } = await transaction
		.selectFrom("archive_publication_state")
		.select("revision")
		.where("id", "=", 1)
		.executeTakeFirstOrThrow();
	return {
		revision,
		documents: await loadArchiveDocuments(transaction, { log: () => {} }),
	};
};

/** Previews read consistently without allocating versions or modifying publication state. */
export const readPublicationSnapshot = (
	database: Kysely<Database>,
): Promise<PublicationSnapshot> =>
	database
		.transaction()
		.setIsolationLevel("repeatable read")
		.setAccessMode("read only")
		.execute(loadPublicationSnapshot);
