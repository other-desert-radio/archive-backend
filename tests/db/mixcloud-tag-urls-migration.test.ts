import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createImports } from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import { up as addTags } from "../../src/db/migrations/0025_add_mixcloud_source_tags.js";
import {
	down,
	up,
} from "../../src/db/migrations/0027_require_mixcloud_tag_urls.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"tag URLs are required without rewriting source data",
	async () => {
		const schema = `tag_urls_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		const write = (key: string, tags: unknown) =>
			db
				.insertInto("mixcloud_import")
				.values({
					key,
					mixcloud_tags: tags === null ? null : JSON.stringify(tags),
				})
				.execute();
		const invalidTags = [
			[{ key: "/a/", name: "A" }],
			[{ key: "/a/", name: "A", url: null }],
			[{ key: "/a/", name: "A", url: 1 }],
			[{ key: "/a/", name: "A", url: [] }],
		];
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			await createShows(db);
			await createImports(db);
			await addTags(db);
			for (const tags of invalidTags) {
				await write("/legacy/", tags);
				await expect(db.transaction().execute(up)).rejects.toThrow();
				await db
					.deleteFrom("mixcloud_import")
					.where("key", "=", "/legacy/")
					.execute();
			}
			const tags = [
				{ key: "/a/", name: "A", url: "https://www.mixcloud.com/a/" },
			];
			await write("/complete/", tags);
			await write("/unknown/", null);
			await write("/empty/", []);
			const before = await db
				.selectFrom("mixcloud_import")
				.selectAll()
				.orderBy("id")
				.execute();
			await db.transaction().execute(up);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.selectAll()
					.orderBy("id")
					.execute(),
			).toEqual(before);
			for (const invalid of invalidTags) {
				await expect(write("/invalid/", invalid)).rejects.toThrow();
				await expect(
					db
						.updateTable("mixcloud_import")
						.set({ mixcloud_tags: JSON.stringify(invalid) })
						.where("key", "=", "/complete/")
						.execute(),
				).rejects.toThrow();
			}
			await write("/new/", tags);
			await db.transaction().execute(down);
			await write("/legacy-again/", invalidTags[0]);
			expect(
				(
					await db
						.selectFrom("mixcloud_import")
						.select("mixcloud_tags")
						.where("key", "=", "/complete/")
						.executeTakeFirstOrThrow()
				).mixcloud_tags,
			).toEqual(tags);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
