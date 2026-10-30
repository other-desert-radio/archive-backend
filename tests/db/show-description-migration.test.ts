import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import {
	down,
	up,
} from "../../src/db/migrations/0041_sanitize_show_descriptions.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.SHOW_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"description migration preserves null/empty and converts literal HTML through rollback/reapply",
	async () => {
		const schema = `show_description_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`CREATE TABLE shows (id serial primary key, description text)`.execute(
				db,
			);
			await sql`INSERT INTO shows (description) VALUES (NULL), (''), ('First & second' || chr(10) || '<script>literal</script>')`.execute(
				db,
			);
			const descriptions = async () =>
				(
					await db
						.selectFrom("shows")
						.select("description")
						.orderBy("id")
						.execute()
				).map((row) => row.description);
			await db.transaction().execute(up);
			const converted = [
				null,
				"",
				"<p>First &amp; second<br />&lt;script&gt;literal&lt;/script&gt;</p>",
			];
			expect(await descriptions()).toEqual(converted);
			await db.transaction().execute(down);
			expect(await descriptions()).toEqual([
				null,
				"",
				"First & second\n<script>literal</script>",
			]);
			await db.transaction().execute(up);
			expect(await descriptions()).toEqual(converted);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
