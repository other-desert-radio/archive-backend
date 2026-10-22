import type { Kysely } from "kysely";
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

/** Revision and all exported data share one read-only repeatable-read snapshot. */
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
			return {
				revision,
				documents: await loadArchiveDocuments(transaction, { log: () => {} }),
			};
		});
