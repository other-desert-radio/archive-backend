import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { down, up } from "../../src/db/migrations/0042_optional_dj_bio.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.DJ_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"optional bio migration preserves existing text and supports rollback/reapply",
	async () => {
		const schema = `dj_bio_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`CREATE TABLE djs (id serial primary key, title text NOT NULL, bio text NOT NULL)`.execute(
				db,
			);
			await sql`INSERT INTO djs (title, bio) VALUES ('Existing', '<p>Bio</p>')`.execute(
				db,
			);
			await db.transaction().execute(up);
			const inserted = await db
				.insertInto("djs")
				.values({ title: "No bio" })
				.returning("bio")
				.executeTakeFirstOrThrow();
			expect(inserted.bio).toBe("");
			await db.transaction().execute(down);
			await expect(
				db.insertInto("djs").values({ title: "Missing" }).execute(),
			).rejects.toThrow();
			await db.transaction().execute(up);
			expect(
				(
					await db
						.insertInto("djs")
						.values({ title: "Reapplied" })
						.returning("bio")
						.executeTakeFirstOrThrow()
				).bio,
			).toBe("");
			expect(
				(await db.selectFrom("djs").select("bio").orderBy("id").execute()).map(
					(row) => row.bio,
				),
			).toEqual(["<p>Bio</p>", "", ""]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
