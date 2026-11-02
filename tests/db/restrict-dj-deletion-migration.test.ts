import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShowDJs } from "../../src/db/migrations/0004_create_show_djs_table.js";
import { down, up } from "../../src/db/migrations/0043_restrict_dj_deletion.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.DJ_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"DJ deletion restriction preserves links, blocks direct deletion, and rolls back",
	async () => {
		const schema = `dj_delete_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`CREATE TABLE djs (id integer PRIMARY KEY, title text NOT NULL)`.execute(
				db,
			);
			await sql`CREATE TABLE shows (id integer PRIMARY KEY, title text NOT NULL)`.execute(
				db,
			);
			await createShowDJs(db);
			await sql`INSERT INTO djs VALUES (1, 'Linked DJ'), (2, 'Other DJ'), (3, 'Rollback DJ')`.execute(
				db,
			);
			await sql`INSERT INTO shows VALUES (1, 'Shared Show'), (2, 'Rollback Show')`.execute(
				db,
			);
			await db
				.insertInto("show_djs")
				.values([
					{ show_id: 1, dj_id: 1 },
					{ show_id: 1, dj_id: 2 },
					{ show_id: 2, dj_id: 3 },
				])
				.execute();
			const links = await db
				.selectFrom("show_djs")
				.selectAll()
				.orderBy("id")
				.execute();
			await db.transaction().execute(up);
			expect(
				await db.selectFrom("show_djs").selectAll().orderBy("id").execute(),
			).toEqual(links);
			await expect(
				db.deleteFrom("djs").where("id", "=", 1).execute(),
			).rejects.toMatchObject({
				code: "23503",
				constraint: "show_djs_dj_id_fkey",
			});
			expect(
				await db.selectFrom("show_djs").selectAll().orderBy("id").execute(),
			).toEqual(links);
			await db.deleteFrom("show_djs").where("dj_id", "=", 1).execute();
			await db.deleteFrom("djs").where("id", "=", 1).execute();
			expect(
				await db.selectFrom("shows").select("id").orderBy("id").execute(),
			).toEqual([{ id: 1 }, { id: 2 }]);
			await db.deleteFrom("shows").where("id", "=", 1).execute();
			await db.deleteFrom("djs").where("id", "=", 2).execute();
			await db.transaction().execute(down);
			await db.deleteFrom("djs").where("id", "=", 3).execute();
			expect(await db.selectFrom("show_djs").selectAll().execute()).toEqual([]);
			expect(await db.selectFrom("shows").select("id").execute()).toEqual([
				{ id: 2 },
			]);
			await db.transaction().execute(up);
			await sql`INSERT INTO djs VALUES (4, 'Reapplied DJ')`.execute(db);
			await db
				.insertInto("show_djs")
				.values({ show_id: 2, dj_id: 4 })
				.execute();
			await expect(
				db.deleteFrom("djs").where("id", "=", 4).execute(),
			).rejects.toMatchObject({ code: "23503" });
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
