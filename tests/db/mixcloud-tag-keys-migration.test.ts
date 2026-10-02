import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createTags } from "../../src/db/migrations/0003_create_tags_table.js";
import { up as addTagMetadata } from "../../src/db/migrations/0017_add_mixcloud_metadata_to_tags.js";
import { up as createImports } from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import {
	down,
	up,
} from "../../src/db/migrations/0020_add_mixcloud_tag_keys.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Mixcloud tag keys array, unique genre keys, and rollback",
	async () => {
		const schema = `mixcloud_tags_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await db
				.insertInto("mixcloud_import")
				.values({ key: "/existing/" })
				.execute();
			await sql`INSERT INTO tags (name, mixcloud_key) VALUES ('House', '/genres/house/'), ('Duplicate', '/genres/house/')`.execute(
				db,
			);
			await expect(db.transaction().execute(up)).rejects.toThrow();
			await sql`DELETE FROM tags WHERE name = 'Duplicate'`.execute(db);
			await db.transaction().execute(up);
			const existing = await db
				.selectFrom("mixcloud_import")
				.select("mixcloud_tag_keys")
				.executeTakeFirstOrThrow();
			expect(existing.mixcloud_tag_keys).toBeNull();
			const keys = ["/genres/house/", "/genres/ambient/"];
			await db
				.insertInto("mixcloud_import")
				.values([
					{ key: "/populated/", mixcloud_tag_keys: keys },
					{ key: "/empty/", mixcloud_tag_keys: [] },
				])
				.execute();
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(["key", "mixcloud_tag_keys"])
					.orderBy("id")
					.execute(),
			).toEqual([
				{ key: "/existing/", mixcloud_tag_keys: null },
				{ key: "/populated/", mixcloud_tag_keys: keys },
				{ key: "/empty/", mixcloud_tag_keys: [] },
			]);
			await expect(
				sql`INSERT INTO tags (name, mixcloud_key) VALUES ('Duplicate', '/genres/house/')`.execute(
					db,
				),
			).rejects.toThrow();
			await sql`INSERT INTO tags (name, mixcloud_key) VALUES ('Ambient', '/genres/ambient/'), ('Unknown one', NULL), ('Unknown two', NULL)`.execute(
				db,
			);
			await expect(
				sql`UPDATE tags SET mixcloud_key = '/genres/house/' WHERE name = 'Ambient'`.execute(
					db,
				),
			).rejects.toThrow();
			await db.transaction().execute(down);
			await sql`INSERT INTO tags (name, mixcloud_key) VALUES ('Duplicate', '/genres/house/')`.execute(
				db,
			);
			expect(
				(
					await sql<{
						count: number;
					}>`SELECT count(*)::integer AS count FROM tags`.execute(db)
				).rows[0]?.count,
			).toBe(5);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select("key")
					.orderBy("id")
					.execute(),
			).toEqual([
				{ key: "/existing/" },
				{ key: "/populated/" },
				{ key: "/empty/" },
			]);
			const columns = await sql<{
				column_name: string;
			}>`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'mixcloud_import'`.execute(
				db,
			);
			expect(
				columns.rows.some(
					(column) => column.column_name === "mixcloud_tag_keys",
				),
			).toBe(false);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
