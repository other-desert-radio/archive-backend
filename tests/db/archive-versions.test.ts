import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import {
	allocateArchiveVersions,
	archiveContentHashes,
} from "../../src/db/archive-versions.js";
import type { ArchiveDocuments } from "../../src/db/export-archive.js";
import { up as createJobs } from "../../src/db/migrations/0030_add_archive_publication_jobs.js";
import {
	down,
	up,
} from "../../src/db/migrations/0040_add_archive_dataset_versions.js";
import type { Database } from "../../src/db/types.js";

const documents = (): ArchiveDocuments => ({
	shows: [],
	djs: [],
	djsBrief: [],
	tags: [],
	images: [],
});
const databaseUrl = process.env.ARCHIVE_VERSIONS_TEST_DATABASE_URL;

async function withDatabase(
	run: (database: Kysely<Database>) => Promise<void>,
) {
	const schema = `versions_${crypto.randomUUID().replaceAll("-", "")}`;
	const database = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new Pool({
				connectionString: databaseUrl,
				options: `-c search_path=${schema}`,
				max: 4,
			}),
		}),
	});
	try {
		await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(database);
		await database.transaction().execute(createJobs);
		await database.transaction().execute(up);
		await run(database);
	} finally {
		await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(
			database,
		);
		await database.destroy();
	}
}

function job() {
	return {
		id: crypto.randomUUID(),
		requested_by: "test",
		repository: "test",
		checkout_path: "/test",
		branch: "main",
	};
}

test("hashes public content independently, including DJ image bytes and embedded DJ data", () => {
	const data = documents();
	const original = archiveContentHashes(data);
	expect(archiveContentHashes(structuredClone(data))).toEqual(original);
	data.tags.push({ id: 1, title: "Tag", color: "#ffffff" });
	expect(archiveContentHashes(data)).toEqual({
		...original,
		tags: expect.any(String),
	});
	expect(archiveContentHashes(data).tags).not.toBe(original.tags);
	data.images.push({ id: 1, variant: "small", bytes: Buffer.from("first") });
	const firstImage = archiveContentHashes(data);
	data.images = [{ id: 1, variant: "small", bytes: Buffer.from("second") }];
	expect(archiveContentHashes(data).djs).not.toBe(firstImage.djs);
	expect(archiveContentHashes(data).shows).toBe(original.shows);
	data.shows.push({
		id: 1,
		title: "Show",
		date: new Date("2026-01-01"),
		duration: 60,
		image_small: "small",
		image_large: "large",
		url: "audio",
		tagIds: [],
		djs: [{ id: 1, title: "DJ" }],
	});
	const firstShow = archiveContentHashes(data).shows;
	data.shows = data.shows.map((show) => ({
		...show,
		djs: [{ id: 1, title: "Renamed DJ" }],
	}));
	expect(archiveContentHashes(data).shows).not.toBe(firstShow);
});

test.skipIf(!databaseUrl)(
	"allocates durable versions, preserves no-op timestamps, and snapshots jobs",
	async () => {
		await withDatabase(async (database) => {
			const data = documents();
			const pending = job();
			await database
				.insertInto("archive_publication_jobs")
				.values(pending)
				.execute();
			const first = await allocateArchiveVersions(
				database,
				async () => ({ documents: data }),
				pending.id,
			);
			for (const version of Object.values(first.versions)) {
				expect(version.id).toBe(1);
				expect(new Date(version.updatedAt).toISOString()).toBe(
					version.updatedAt,
				);
			}
			const saved = await database
				.selectFrom("archive_publication_jobs")
				.select("dataset_versions")
				.where("id", "=", pending.id)
				.executeTakeFirstOrThrow();
			expect(saved.dataset_versions).toEqual(first.versions);
			const retry = await allocateArchiveVersions(
				database,
				async () => ({ documents: data }),
				pending.id,
			);
			expect(retry.versions).toEqual(first.versions);
			data.tags.push({ id: 1, title: "New", color: "#ffffff" });
			const changed = await allocateArchiveVersions(database, async () => ({
				documents: data,
			}));
			expect(changed.versions.tags.id).toBe(2);
			expect(changed.versions.shows).toEqual(first.versions.shows);
			expect(changed.versions.djs).toEqual(first.versions.djs);
			await database.deleteFrom("archive_publication_jobs").execute();
			expect(
				(
					await allocateArchiveVersions(database, async () => ({
						documents: data,
					}))
				).versions,
			).toEqual(changed.versions);
			data.tags = [];
			expect(
				(
					await allocateArchiveVersions(database, async () => ({
						documents: data,
					}))
				).versions.tags.id,
			).toBe(3);
		});
	},
);

test.skipIf(!databaseUrl)(
	"rolls back failed allocation and releases the session lock",
	async () => {
		await withDatabase(async (database) => {
			await expect(
				allocateArchiveVersions(
					database,
					async () => ({ documents: documents() }),
					crypto.randomUUID(),
				),
			).rejects.toThrow();
			expect(
				await database
					.selectFrom("archive_dataset_versions")
					.selectAll()
					.execute(),
			).toEqual([]);
			await expect(
				allocateArchiveVersions(database, async () => {
					throw new Error("read failed");
				}),
			).rejects.toThrow("read failed");
			const next = await allocateArchiveVersions(database, async () => ({
				documents: documents(),
			}));
			expect(next.versions.shows.id).toBe(1);
		});
	},
);

test.skipIf(!databaseUrl)(
	"concurrent exporters share one allocation for identical content",
	async () => {
		await withDatabase(async (database) => {
			const results = await Promise.all(
				[1, 2].map(() =>
					allocateArchiveVersions(database, async (transaction) => {
						await sql`SELECT pg_sleep(0.05)`.execute(transaction);
						return { documents: documents() };
					}),
				),
			);
			expect(results[0]?.versions).toEqual(results[1]?.versions);
			expect(results[0]?.versions.shows.id).toBe(1);
		});
	},
);

test.skipIf(!databaseUrl)(
	"migration preserves existing jobs, enforces constraints, and rolls back",
	async () => {
		await withDatabase(async (database) => {
			const pending = job();
			await database
				.insertInto("archive_publication_jobs")
				.values(pending)
				.execute();
			await database.transaction().execute(down);
			await database.transaction().execute(up);
			expect(
				(
					await database
						.selectFrom("archive_publication_jobs")
						.selectAll()
						.where("id", "=", pending.id)
						.executeTakeFirstOrThrow()
				).dataset_versions,
			).toBeNull();
			for (const values of [
				{ dataset: "invalid", version: 1, content_hash: "a".repeat(64) },
				{ dataset: "shows", version: 0, content_hash: "a".repeat(64) },
				{ dataset: "shows", version: 1, content_hash: "invalid" },
			]) {
				await expect(
					sql`INSERT INTO archive_dataset_versions (dataset, version, updated_at, content_hash) VALUES (${values.dataset}, ${values.version}, CURRENT_TIMESTAMP, ${values.content_hash})`.execute(
						database,
					),
				).rejects.toThrow();
			}
			await allocateArchiveVersions(database, async () => ({
				documents: documents(),
			}));
			await database.transaction().execute(down);
			expect(
				(
					await sql`SELECT to_regclass('archive_dataset_versions') AS relation`.execute(
						database,
					)
				).rows,
			).toEqual([{ relation: null }]);
			expect(
				(
					await database
						.selectFrom("archive_publication_jobs")
						.select("id")
						.execute()
				).map((row) => row.id),
			).toEqual([pending.id]);
		});
	},
);
