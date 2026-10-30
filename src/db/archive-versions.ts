import { createHash } from "node:crypto";
import { type Kysely, sql, type Transaction } from "kysely";
import type { ArchiveDocuments } from "./export-archive.js";
import type { Database } from "./types.js";

/** Manifest id matches the payload version; updatedAt is a UTC ISO timestamp. */
export type DatasetVersion = { id: number; updatedAt: string };
export type DatasetVersions = Record<"shows" | "djs" | "tags", DatasetVersion>;

/** Hash the public content, including image bytes that JSON only references. */
export function archiveContentHashes(documents: ArchiveDocuments) {
	// Export ordering must stay deterministic; array order contributes to the hash.
	const hash = (value: unknown) =>
		createHash("sha256").update(JSON.stringify(value)).digest("hex");
	// Frame each raw image with its identity and byte length to keep boundaries unambiguous.
	const djs = createHash("sha256").update(
		JSON.stringify({ brief: documents.djsBrief, details: documents.djs }),
	);
	for (const image of documents.images) {
		djs.update(JSON.stringify([image.id, image.variant, image.bytes.length]));
		djs.update(image.bytes);
	}
	return {
		shows: hash(documents.shows),
		djs: djs.digest("hex"),
		tags: hash(documents.tags),
	};
}

/** Keep the same database session locked through allocation, filesystem writes, and Git work. */
export async function withArchiveExportLock<T>(
	database: Kysely<Database>,
	run: (connection: Kysely<Database>) => Promise<T>,
): Promise<T> {
	return database.connection().execute(async (connection) => {
		// Session locks are reentrant; nested allocation must use this pinned connection.
		await sql`SELECT pg_advisory_lock(184728, 40)`.execute(connection);
		try {
			return await run(connection);
		} finally {
			// Session locks survive rollback, so release before returning to the pool.
			await sql`SELECT pg_advisory_unlock(184728, 40)`.execute(connection);
		}
	});
}

/**
 * Allocate content versions, not publication acknowledgements: failed file writes
 * may leave allocated versions behind. An unchanged retry keeps that metadata.
 * Load database documents through the supplied transaction for a consistent snapshot.
 */
export async function allocateArchiveVersions<
	T extends { documents: ArchiveDocuments },
>(
	database: Kysely<Database>,
	load: (transaction: Transaction<Database>) => Promise<T>,
	jobId?: string,
): Promise<T & { versions: DatasetVersions }> {
	return withArchiveExportLock(database, async (connection) => {
		return await connection
			.transaction()
			.setIsolationLevel("repeatable read")
			.execute(async (transaction) => {
				const snapshot = await load(transaction);
				const hashes = archiveContentHashes(snapshot.documents);
				const versions = {} as DatasetVersions;
				// All datasets changed by this allocation share one timestamp.
				const now = new Date().toISOString();
				for (const dataset of ["shows", "djs", "tags"] as const) {
					const previous = await transaction
						.selectFrom("archive_dataset_versions")
						.selectAll()
						.where("dataset", "=", dataset)
						.executeTakeFirst();
					const unchanged = previous?.content_hash === hashes[dataset];
					// First export starts at 1; no-op exports preserve both version and time.
					const version = unchanged
						? previous.version
						: (previous?.version ?? 0) + 1;
					const updatedAt = unchanged ? previous.updated_at.toISOString() : now;
					if (!unchanged) {
						await transaction
							.insertInto("archive_dataset_versions")
							.values({
								dataset,
								version,
								updated_at: new Date(updatedAt),
								content_hash: hashes[dataset],
							})
							.onConflict((c) =>
								c.column("dataset").doUpdateSet({
									version,
									updated_at: new Date(updatedAt),
									content_hash: hashes[dataset],
								}),
							)
							.execute();
					}

					versions[dataset] = { id: version, updatedAt };
				}
				// Persist the job snapshot atomically; an absent or completed job rolls back allocation.
				if (jobId) {
					await transaction
						.updateTable("archive_publication_jobs")
						.set({ dataset_versions: JSON.stringify(versions) })
						.where("id", "=", jobId)
						.where("outcome", "=", "running")
						.returning("id")
						.executeTakeFirstOrThrow();
				}
				return { ...snapshot, versions };
			});
	});
}
