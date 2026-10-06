import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createImports } from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import {
	down,
	up,
} from "../../src/db/migrations/0025_add_mixcloud_source_tags.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"source tag migration preserves names and existing rows and rolls back",
	async () => {
		const schema = `source_tags_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await createImports(db);
			await db
				.insertInto("mixcloud_import")
				.values({ key: "/existing/" })
				.execute();
			await db.transaction().execute(up);
			expect(
				(
					await db
						.selectFrom("mixcloud_import")
						.select("mixcloud_tags")
						.executeTakeFirstOrThrow()
				).mixcloud_tags,
			).toBeNull();
			const tags = [{ key: "/genres/experimental/", name: "ExPeRiMeNtAl" }];
			await db
				.insertInto("mixcloud_import")
				.values({ key: "/new/", mixcloud_tags: JSON.stringify(tags) })
				.execute();
			expect(
				(
					await db
						.selectFrom("mixcloud_import")
						.select("mixcloud_tags")
						.where("key", "=", "/new/")
						.executeTakeFirstOrThrow()
				).mixcloud_tags,
			).toEqual(tags);
			await expect(
				db
					.insertInto("mixcloud_import")
					.values({ key: "/invalid/", mixcloud_tags: "{}" })
					.execute(),
			).rejects.toThrow();
			await db.transaction().execute(down);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select("key")
					.orderBy("id")
					.execute(),
			).toEqual([{ key: "/existing/" }, { key: "/new/" }]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
