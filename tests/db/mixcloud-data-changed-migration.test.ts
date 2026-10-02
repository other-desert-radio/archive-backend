import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createImports } from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import {
	down,
	up,
} from "../../src/db/migrations/0021_add_mixcloud_data_changed.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Mixcloud change flag defaults, updates, constraint, and rollback",
	async () => {
		const schema = `mixcloud_changed_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await up(db);
			await db.insertInto("mixcloud_import").values({ key: "/new/" }).execute();
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(["key", "data_changed"])
					.orderBy("id")
					.execute(),
			).toEqual([
				{ key: "/existing/", data_changed: false },
				{ key: "/new/", data_changed: false },
			]);
			await db
				.updateTable("mixcloud_import")
				.set({ data_changed: true })
				.where("key", "=", "/existing/")
				.execute();
			expect(
				(
					await db
						.selectFrom("mixcloud_import")
						.select("data_changed")
						.where("key", "=", "/existing/")
						.executeTakeFirstOrThrow()
				).data_changed,
			).toBe(true);
			await expect(
				sql`UPDATE mixcloud_import SET data_changed = NULL`.execute(db),
			).rejects.toThrow();
			await down(db);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(["key", "show_id", "imported_at"])
					.orderBy("id")
					.execute(),
			).toEqual([
				{ key: "/existing/", show_id: null, imported_at: null },
				{ key: "/new/", show_id: null, imported_at: null },
			]);
			const columns = await sql<{
				column_name: string;
			}>`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'mixcloud_import'`.execute(
				db,
			);
			expect(
				columns.rows.some((column) => column.column_name === "data_changed"),
			).toBe(false);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
