import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createDJs } from "../../src/db/migrations/0001_create_djs_table.js";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createTags } from "../../src/db/migrations/0003_create_tags_table.js";
import { up as createShowDJs } from "../../src/db/migrations/0004_create_show_djs_table.js";
import { up as createShowTags } from "../../src/db/migrations/0005_create_show_tags_table.js";
import { up as createDJTags } from "../../src/db/migrations/0006_create_dj_tags_table.js";
import {
	down,
	up,
} from "../../src/db/migrations/0029_add_archive_publication_state.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.PUBLICATION_MIGRATION_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"publication revisions track statements transactionally, notify after commit, and roll back safely",
	async () => {
		const schema = `publication_${crypto.randomUUID().replaceAll("-", "")}`;
		const pool = new Pool({
			connectionString: databaseUrl,
			options: `-c search_path=${schema}`,
		});
		const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
		const listener = await pool.connect();
		const messages: string[] = [];
		listener.on("notification", (message) => {
			if (message.payload) messages.push(message.payload);
		});
		// A marker on the same connection as writes drains earlier committed NOTIFYs.
		const drain = async () => {
			const marker = crypto.randomUUID();
			const delivered = new Promise<void>((resolve, reject) => {
				const timer = setTimeout(() => {
					listener.off("notification", onMessage);
					reject(new Error("Timed out waiting for publication notification"));
				}, 3000);
				const onMessage = (message: { payload?: string }) => {
					if (message.payload !== marker) return;
					clearTimeout(timer);
					listener.off("notification", onMessage);
					resolve();
				};
				listener.on("notification", onMessage);
			});
			await sql`SELECT pg_notify('archive_publication_changed', ${marker})`.execute(
				db,
			);
			await delivered;
			messages.splice(messages.indexOf(marker), 1);
		};
		const state = () =>
			db
				.selectFrom("archive_publication_state")
				.selectAll()
				.executeTakeFirstOrThrow();
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			for (const create of [
				createDJs,
				createShows,
				createTags,
				createShowDJs,
				createShowTags,
				createDJTags,
			]) {
				await create(db);
			}
			await sql`INSERT INTO djs (title, bio) VALUES ('DJ 1', ''), ('DJ 2', '')`.execute(
				db,
			);
			await sql`INSERT INTO shows (title, date, duration) VALUES ('Show 1', now(), 60), ('Show 2', now(), 60)`.execute(
				db,
			);
			await sql`INSERT INTO tags (name) VALUES ('Tag 1'), ('Tag 2')`.execute(
				db,
			);
			await db.transaction().execute(up);
			expect(await state()).toEqual({
				id: 1,
				revision: "1",
				published_revision: "0",
			});
			await expect(
				sql`INSERT INTO archive_publication_state DEFAULT VALUES`.execute(db),
			).rejects.toThrow();
			await expect(
				sql`INSERT INTO archive_publication_state (id) VALUES (2)`.execute(db),
			).rejects.toThrow();
			await expect(
				sql`UPDATE archive_publication_state SET published_revision = 2`.execute(
					db,
				),
			).rejects.toThrow();
			await listener.query("LISTEN archive_publication_changed");
			const cases = [
				[
					"djs",
					"INSERT INTO djs (title, bio) VALUES ('A', ''), ('B', '')",
					"id > 2",
				],
				[
					"shows",
					"INSERT INTO shows (title, date, duration) VALUES ('A', now(), 1), ('B', now(), 1)",
					"id > 2",
				],
				["tags", "INSERT INTO tags (name) VALUES ('A'), ('B')", "id > 2"],
				[
					"show_djs",
					"INSERT INTO show_djs (show_id, dj_id) VALUES (1, 1), (2, 2)",
					"true",
				],
				[
					"show_tags",
					"INSERT INTO show_tags (show_id, tag_id) VALUES (1, 1), (2, 2)",
					"true",
				],
				[
					"dj_tags",
					"INSERT INTO dj_tags (dj_id, tag_id) VALUES (1, 1), (2, 2)",
					"true",
				],
			] as const;
			let revision = 1n;
			for (const [table, insert, predicate] of cases) {
				for (const [operation, statement] of [
					sql.raw(insert),
					sql`UPDATE ${sql.id(table)} SET id = id`,
					sql`DELETE FROM ${sql.id(table)} WHERE ${sql.raw(predicate)}`,
				].entries()) {
					await statement.execute(db);
					revision += 1n;
					// Parent DELETE invokes two cascading relationship DELETE statements,
					// including when those relationship tables contain no matching rows.
					if (operation === 2 && ["djs", "shows", "tags"].includes(table))
						revision += 2n;
					expect((await state()).revision).toBe(String(revision));
				}
			}
			await drain();
			expect(messages).toEqual(
				Array.from({ length: 24 }, (_, index) => String(index + 2)),
			);
			messages.length = 0;
			await expect(
				db.transaction().execute(async (transaction) => {
					await sql`UPDATE djs SET title = 'rolled back'`.execute(transaction);
					expect(
						(
							await transaction
								.selectFrom("archive_publication_state")
								.selectAll()
								.executeTakeFirstOrThrow()
						).revision,
					).toBe(String(revision + 1n));
					await drain();
					expect(messages).toEqual([]);
					throw new Error("intentional rollback");
				}),
			).rejects.toThrow("intentional rollback");
			await drain();
			expect(messages).toEqual([]);
			expect((await state()).revision).toBe(String(revision));
			const first = await pool.connect();
			const second = await pool.connect();
			try {
				await first.query("BEGIN");
				await second.query("BEGIN");
				await first.query("UPDATE djs SET title = title WHERE id = 1");
				const concurrent = second.query(
					"UPDATE tags SET name = name WHERE id = 1",
				);
				await first.query("COMMIT");
				await concurrent;
				await second.query("COMMIT");
			} finally {
				await first.query("ROLLBACK");
				await second.query("ROLLBACK");
				first.release();
				second.release();
			}
			revision += 2n;
			expect((await state()).revision).toBe(String(revision));
			// Zero-row writes and TRUNCATE also conservatively signal pending work.
			await sql`DELETE FROM tags WHERE id = -1`.execute(db);
			await sql`TRUNCATE show_djs, show_tags, dj_tags`.execute(db);
			revision += 4n;
			expect((await state()).revision).toBe(String(revision));
			// pg must preserve bigint precision above JavaScript's safe integer range.
			await sql`UPDATE archive_publication_state SET revision = 9007199254740992`.execute(
				db,
			);
			await sql`UPDATE tags SET name = name WHERE id = 1`.execute(db);
			expect((await state()).revision).toBe("9007199254740993");
			const records = await sql`SELECT * FROM djs ORDER BY id`.execute(db);
			await db.transaction().execute(down);
			expect(
				(await sql`SELECT * FROM djs ORDER BY id`.execute(db)).rows,
			).toEqual(records.rows);
			await sql`UPDATE djs SET title = title`.execute(db);
			const remaining = await sql<{
				state: string | null;
				function: string | null;
			}>`SELECT to_regclass('archive_publication_state')::text AS state, to_regprocedure('advance_archive_publication_revision()')::text AS function`.execute(
				db,
			);
			expect(remaining.rows).toEqual([{ state: null, function: null }]);
			await db.transaction().execute(up);
			expect(await state()).toEqual({
				id: 1,
				revision: "1",
				published_revision: "0",
			});
		} finally {
			await listener.query("UNLISTEN *");
			listener.release();
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
	15000,
);
