import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createTags } from "../../src/db/migrations/0003_create_tags_table.js";
import { up as addTagMetadata } from "../../src/db/migrations/0017_add_mixcloud_metadata_to_tags.js";
import { up as createImports } from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import { up as addTagKeys } from "../../src/db/migrations/0020_add_mixcloud_tag_keys.js";
import { up as addSourceTags } from "../../src/db/migrations/0025_add_mixcloud_source_tags.js";
import {
	down,
	up,
} from "../../src/db/migrations/0026_drop_mixcloud_tag_keys.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"drop legacy tag keys preserves JSON, legacy keys, links and rollback",
	async () => {
		const schema = `drop_tag_keys_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			await createShows(db);
			await createTags(db);
			await addTagMetadata(db);
			await createImports(db);
			await addTagKeys(db);
			await addSourceTags(db);
			await sql`INSERT INTO shows (title, date, duration) VALUES ('Preserved', '2026-10-01', 3600)`.execute(
				db,
			);
			await sql`INSERT INTO tags (name, mixcloud_key) VALUES ('Unique', '/a/')`.execute(
				db,
			);
			await sql`INSERT INTO mixcloud_import (key, mixcloud_tag_keys, mixcloud_tags, show_id, imported_at) VALUES
   ('unknown', NULL, NULL, NULL, NULL),
   ('empty', ARRAY[]::text[], NULL, NULL, NULL),
   ('legacy', ARRAY['/b/', '/a/', '/a/'], NULL, NULL, NULL),
   ('complete', ARRAY['/a/'], '[{"key":"/a/","name":"Original","url":"https://www.mixcloud.com/a/"}]', 1, '2026-10-01'),
   ('partial', ARRAY['/a/', '/b/'], '[{"key":"/a/","name":"Original","url":"https://www.mixcloud.com/a/"}]', NULL, NULL),
   ('json-only', NULL, '[{"key":"/c/","name":"C"}]', NULL, NULL)`.execute(db);
			const before = await db
				.selectFrom("mixcloud_import")
				.select(["id", "key", "createdAt", "show_id", "imported_at"])
				.orderBy("id")
				.execute();
			await db.transaction().execute(up);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(["id", "key", "createdAt", "show_id", "imported_at"])
					.orderBy("id")
					.execute(),
			).toEqual(before);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(["key", "mixcloud_tags"])
					.orderBy("id")
					.execute(),
			).toEqual([
				{ key: "unknown", mixcloud_tags: null },
				{ key: "empty", mixcloud_tags: [] },
				{
					key: "legacy",
					mixcloud_tags: [
						{ key: "/a/", name: "" },
						{ key: "/b/", name: "" },
					],
				},
				{
					key: "complete",
					mixcloud_tags: [
						{
							key: "/a/",
							name: "Original",
							url: "https://www.mixcloud.com/a/",
						},
					],
				},
				{
					key: "partial",
					mixcloud_tags: [
						{
							key: "/a/",
							name: "Original",
							url: "https://www.mixcloud.com/a/",
						},
						{ key: "/b/", name: "" },
					],
				},
				{ key: "json-only", mixcloud_tags: [{ key: "/c/", name: "C" }] },
			]);
			const columns = await sql<{
				column_name: string;
			}>`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'mixcloud_import'`.execute(
				db,
			);
			expect(
				columns.rows.some(
					({ column_name }) => column_name === "mixcloud_tag_keys",
				),
			).toBe(false);
			await expect(
				sql`INSERT INTO tags (name, mixcloud_key) VALUES ('Duplicate', '/a/')`.execute(
					db,
				),
			).rejects.toThrow();
			await db.transaction().execute(down);
			const restored = await sql<{
				key: string;
				mixcloud_tag_keys: string[] | null;
			}>`SELECT key, mixcloud_tag_keys FROM mixcloud_import ORDER BY id`.execute(
				db,
			);
			expect(restored.rows).toEqual([
				{ key: "unknown", mixcloud_tag_keys: null },
				{ key: "empty", mixcloud_tag_keys: [] },
				{ key: "legacy", mixcloud_tag_keys: ["/a/", "/b/"] },
				{ key: "complete", mixcloud_tag_keys: ["/a/"] },
				{ key: "partial", mixcloud_tag_keys: ["/a/", "/b/"] },
				{ key: "json-only", mixcloud_tag_keys: ["/c/"] },
			]);
			await db.transaction().execute(up);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
