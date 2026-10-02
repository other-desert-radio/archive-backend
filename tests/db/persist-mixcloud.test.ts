import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { MixcloudCloudcast } from "../../src/admin/routes/mixcloud-imports/index.js";
import {
	persistMixcloud,
	persistMixcloudEntry,
} from "../../src/admin/routes/mixcloud-imports/persist-mixcloud.js";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createImports } from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import { up as addMetadata } from "../../src/db/migrations/0019_add_mixcloud_source_metadata.js";
import { up as addFlag } from "../../src/db/migrations/0021_add_mixcloud_data_changed.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;
const entry: MixcloudCloudcast = {
	key: "/source/",
	url: "https://www.mixcloud.com/source/",
	name: "Source show",
	created_time: "2026-09-01T12:00:00Z",
	updated_time: "2026-09-01T12:00:00Z",
	play_count: 0,
	slug: "source",
	audio_length: 3600,
	pictures: { large: "small.jpg", "1024wx1024h": "large.jpg" },
	tags: [
		{ key: "/a/", url: "https://example.test/a", name: "A" },
		{ key: "/b/", url: "https://example.test/b", name: "B" },
	],
};

test.skipIf(!databaseUrl)(
	"single-entry persistence maps fields, detects changes, and preserves imports",
	async () => {
		const schema = `mixcloud_persist_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		const read = () =>
			db
				.selectFrom("mixcloud_import")
				.selectAll()
				.where("key", "=", entry.key)
				.executeTakeFirstOrThrow();
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			await createShows(db);
			await createImports(db);
			await addMetadata(db);
			await db.schema
				.alterTable("mixcloud_import")
				.addColumn("mixcloud_tag_keys", sql`text[]`)
				.execute();
			await addFlag(db);
			await persistMixcloudEntry(db, entry);
			await persistMixcloudEntry(db, { ...entry, key: "/missing-later/" });
			const first = await read();
			expect(first).toMatchObject({
				key: entry.key,
				url: entry.url,
				name: entry.name,
				duration: 3600,
				image_small: "small.jpg",
				image_large: "large.jpg",
				mixcloud_tag_keys: ["/a/", "/b/"],
				show_id: null,
				imported_at: null,
				data_changed: false,
			});
			expect(first.created_time?.toISOString()).toBe(
				"2026-09-01T12:00:00.000Z",
			);
			await persistMixcloudEntry(db, { ...entry, name: "Pending changed" });
			expect((await read()).data_changed).toBe(false);
			for (const pictures of [
				{ ...entry.pictures, large: "pending-small.jpg" },
				{ ...entry.pictures, "1024wx1024h": "pending-large.jpg" },
			]) {
				await persistMixcloudEntry(db, entry);
				await persistMixcloudEntry(db, { ...entry, pictures });
				expect(await read()).toMatchObject({
					image_small: pictures.large,
					image_large: pictures["1024wx1024h"],
					show_id: null,
					imported_at: null,
					data_changed: false,
				});
			}
			await persistMixcloudEntry(db, entry);
			const show = await sql<{
				id: number;
			}>`INSERT INTO shows (title, date, duration) VALUES ('Approved', '2026-09-01', 3600) RETURNING id`.execute(
				db,
			);
			const showId = show.rows[0]?.id;
			if (showId === undefined) throw new Error("Test Show was not created");
			const importedAt = new Date("2026-10-01T12:00:00Z");
			await db
				.updateTable("mixcloud_import")
				.set({
					show_id: showId,
					imported_at: importedAt,
					mixcloud_tag_keys: ["/b/", "/a/", "/a/"],
				})
				.where("key", "=", entry.key)
				.execute();
			await persistMixcloudEntry(db, {
				...entry,
				tags: [...entry.tags].reverse(),
				play_count: 500,
			});
			expect((await read()).data_changed).toBe(false);
			for (const changed of [
				{ ...entry, name: "Changed" },
				{ ...entry, url: "https://example.test/new" },
				{ ...entry, created_time: "2026-09-02T12:00:00Z" },
				{ ...entry, audio_length: 4000 },
				{ ...entry, pictures: { ...entry.pictures, large: "new-small" } },
				{
					...entry,
					pictures: { ...entry.pictures, "1024wx1024h": "new-large" },
				},
				{ ...entry, tags: [] },
			]) {
				await persistMixcloudEntry(db, entry);
				await db
					.updateTable("mixcloud_import")
					.set({ data_changed: false })
					.where("key", "=", entry.key)
					.execute();
				await persistMixcloudEntry(db, changed);
				expect((await read()).data_changed).toBe(true);
				await persistMixcloudEntry(db, changed);
				expect((await read()).data_changed).toBe(true);
			}
			const saved = await read();
			expect(saved.id).toBe(first.id);
			expect(saved.createdAt).toEqual(first.createdAt);
			expect(saved.show_id).toBe(showId);
			expect(saved.imported_at).toEqual(importedAt);
			expect(
				(await db.selectFrom("shows").select("title").executeTakeFirstOrThrow())
					.title,
			).toBe("Approved");
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select("key")
					.orderBy("id")
					.execute(),
			).toHaveLength(2);
			await expect(
				persistMixcloud(db, {
					data: [
						{ ...entry, name: "Must roll back" },
						{ ...entry, key: "/invalid/", audio_length: 1.5 },
					],
				}),
			).rejects.toThrow();
			expect(await read()).toEqual(saved);
			expect(
				await db.selectFrom("mixcloud_import").select("key").execute(),
			).toHaveLength(2);
			await persistMixcloud(db, { data: [] });
			expect(await read()).toEqual(saved);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
