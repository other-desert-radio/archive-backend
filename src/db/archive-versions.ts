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
	return {
		shows: hash(documents.shows),
		// Image URLs can stay unchanged when their bytes change, so include both.
		djs: hash({
			brief: documents.djsBrief,
			details: documents.djs,
			images: documents.images,
		}),
		tags: hash(documents.tags),
	};
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
	return database.connection().execute(async (connection) => {
		// Pin the session: the lock must be acquired and released on the same connection.
		// This shared exporter lock precedes the transaction to avoid a stale waiting snapshot.
		await sql`SELECT pg_advisory_lock(184728, 40)`.execute(connection);
		try {
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
						const updatedAt = unchanged
							? previous.updated_at.toISOString()
							: now;
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
		} finally {
			// Session locks survive rollback, so release explicitly before returning to the pool.
			await sql`SELECT pg_advisory_unlock(184728, 40)`.execute(connection);
		}
	});
}
