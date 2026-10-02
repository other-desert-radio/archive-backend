import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createImports } from "../../src/db/migrations/0018_create_mixcloud_import_table.js";
import {
	down,
	up,
} from "../../src/db/migrations/0022_add_mixcloud_parser_results.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_MIGRATION_TEST_DATABASE_URL;
const parserColumns = [
	"derived_title",
	"derived_date",
	"decoded_djs",
	"parser_version",
	"parser_key",
	"date_source",
] as const;

test.skipIf(!databaseUrl)(
	"Mixcloud parser suggestions default to null, validate date sources, and roll back without losing links",
	async () => {
		const schema = `mixcloud_parser_${crypto.randomUUID().replaceAll("-", "")}`;
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
			const show = await db
				.insertInto("shows")
				.values({
					title: "Approved show",
					date: new Date("2026-01-01T00:00:00Z"),
					duration: 3600,
					url: "https://example.com/show",
				})
				.returning("id")
				.executeTakeFirstOrThrow();
			const importedAt = new Date("2026-02-01T00:00:00Z");
			await db
				.insertInto("mixcloud_import")
				.values({
					key: "/existing/",
					show_id: show.id,
					imported_at: importedAt,
				})
				.execute();
			const before = await db
				.selectFrom("mixcloud_import")
				.selectAll()
				.execute();
			await up(db);
			await db.insertInto("mixcloud_import").values({ key: "/new/" }).execute();
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(parserColumns)
					.orderBy("id")
					.execute(),
			).toEqual([
				Object.fromEntries(parserColumns.map((key) => [key, null])),
				Object.fromEntries(parserColumns.map((key) => [key, null])),
			]);
			const suggestions = {
				derived_title: "Extracted show",
				derived_date: new Date("2026-01-01T00:00:00Z"),
				decoded_djs: ["Caroline", "Ethan"],
				parser_version: 1,
				parser_key: "common-comma-date",
				date_source: "title" as const,
			};
			await db
				.updateTable("mixcloud_import")
				.set(suggestions)
				.where("key", "=", "/existing/")
				.execute();
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(parserColumns)
					.where("key", "=", "/existing/")
					.executeTakeFirstOrThrow(),
			).toEqual(suggestions);
			await db
				.updateTable("mixcloud_import")
				.set({ date_source: "created_time" })
				.where("key", "=", "/new/")
				.execute();
			for (const invalid of ["created_at", "parsed", "fallback", ""]) {
				await expect(
					sql`UPDATE mixcloud_import SET date_source = ${invalid}`.execute(db),
				).rejects.toThrow();
			}
			await down(db);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.selectAll()
					.where("key", "=", "/existing/")
					.execute(),
			).toEqual(before);
			expect(await db.selectFrom("shows").select("title").execute()).toEqual([
				{ title: "Approved show" },
			]);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.select(["key", "show_id", "imported_at"])
					.where("key", "=", "/new/")
					.executeTakeFirstOrThrow(),
			).toEqual({ key: "/new/", show_id: null, imported_at: null });
			const columns = await sql<{
				column_name: string;
			}>`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'mixcloud_import'`.execute(
				db,
			);
			expect(
				columns.rows.filter((column) =>
					parserColumns.some((key) => key === column.column_name),
				),
			).toEqual([]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
