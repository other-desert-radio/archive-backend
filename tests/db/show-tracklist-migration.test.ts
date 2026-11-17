import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { down, up } from "../../src/db/migrations/0044_add_show_tracklist.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.SHOW_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"tracklist migration validates entries, backfills, and rolls back/reapplies",
	async () => {
		const schema = `show_tracklist_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`CREATE TABLE shows (id serial primary key)`.execute(db);
			await sql`INSERT INTO shows DEFAULT VALUES`.execute(db);
			await db.transaction().execute(up);
			expect(
				(
					await db
						.selectFrom("shows")
						.select("tracklist")
						.executeTakeFirstOrThrow()
				).tracklist,
			).toEqual([]);
			const track = { artist: "Artist", song: "Song", start_time: 0 };
			const chapter = { chapter: "Introduction", start_time: null };
			for (const value of [
				[],
				[track],
				[chapter, { ...track, start_time: 245 }],
				[{ ...track, start_time: null }],
			]) {
				await sql`INSERT INTO shows (tracklist) VALUES (${JSON.stringify(value)}::jsonb)`.execute(
					db,
				);
			}
			for (const value of [
				null,
				{},
				"text",
				[null],
				[[]],
				[1],
				[{}],
				[{ ...track, artist: " \t\n" }],
				[{ ...track, song: 5 }],
				[{ artist: "Artist", song: "Song" }],
				[{ ...track, start_time: -1 }],
				[{ ...track, start_time: 1.5 }],
				[{ ...track, start_time: "12" }],
				[{ ...track, start_time: true }],
				[{ ...track, chapter: "Intro" }],
				[{ chapter: " ", start_time: 0 }],
				[{ chapter: 2, start_time: 0 }],
			]) {
				await expect(
					sql`INSERT INTO shows (tracklist) VALUES (${JSON.stringify(value)}::jsonb)`.execute(
						db,
					),
				).rejects.toThrow();
			}
			await expect(
				sql`INSERT INTO shows (tracklist) VALUES (NULL)`.execute(db),
			).rejects.toThrow();
			await db.transaction().execute(down);
			expect(
				(await sql`SELECT * FROM shows LIMIT 1`.execute(db)).rows[0],
			).toEqual({ id: 1 });
			await db.transaction().execute(up);
			expect(
				(await db.selectFrom("shows").select("tracklist").execute()).every(
					(row) => row.tracklist.length === 0,
				),
			).toBe(true);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
