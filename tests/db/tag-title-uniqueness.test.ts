import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { tagRoutes } from "../../src/admin/routes/tags/index.js";
import { createTag } from "../../src/admin/routes/tags/tag-service.js";
import { up as addPublication } from "../../src/db/migrations/0029_add_archive_publication_state.js";
import { down, up } from "../../src/db/migrations/0035_unique_tag_titles.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.TAG_UNIQUENESS_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"tag titles remain unique across concurrent creation and renames; failed migration preserves data",
	async () => {
		const schema = `tag_titles_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
					max: 12,
				}),
			}),
		});
		const app = Fastify();
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			await sql`CREATE TABLE tags (id serial PRIMARY KEY, "createdAt" timestamptz NOT NULL DEFAULT now(), title text NOT NULL, color text, reviewed boolean NOT NULL DEFAULT false, mixcloud_key text UNIQUE, mixcloud_url text)`.execute(
				db,
			);
			for (const table of [
				"djs",
				"shows",
				"show_djs",
				"show_tags",
				"dj_tags",
			]) {
				await sql`CREATE TABLE ${sql.id(table)} (id serial PRIMARY KEY)`.execute(
					db,
				);
			}
			await db.transaction().execute(addPublication);
			await sql`INSERT INTO tags (title, color) VALUES ('House', '#123456'), ('house', '#abcdef')`.execute(
				db,
			);
			const before = await db
				.selectFrom("tags")
				.selectAll()
				.orderBy("id")
				.execute();
			await expect(db.transaction().execute(up)).rejects.toThrow(
				"Duplicate normalized tag titles",
			);
			expect(
				await db.selectFrom("tags").selectAll().orderBy("id").execute(),
			).toEqual(before);
			// The failed transaction must leave neither an index nor partial data changes.
			expect(
				(
					await sql`SELECT indexname FROM pg_indexes WHERE schemaname = ${schema} AND indexname = 'tags_normalized_title_unique'`.execute(
						db,
					)
				).rows,
			).toEqual([]);
			await db
				.updateTable("tags")
				.set({ title: "Ambient" })
				.where("id", "=", 2)
				.execute();
			await sql`INSERT INTO tags (title) VALUES (${"\t\u00a0Legacy\ufeff"})`.execute(
				db,
			);
			const beforeWhitespaceCheck = await db
				.selectFrom("tags")
				.selectAll()
				.orderBy("id")
				.execute();
			await expect(db.transaction().execute(up)).rejects.toThrow(
				"Untrimmed or blank tag titles",
			);
			expect(
				await db.selectFrom("tags").selectAll().orderBy("id").execute(),
			).toEqual(beforeWhitespaceCheck);
			await db
				.updateTable("tags")
				.set({ title: "Legacy" })
				.where("id", "=", 3)
				.execute();
			await db.transaction().execute(up);
			// Delay writes so concurrent callers pass the read-before-write check.
			await sql`CREATE FUNCTION slow_tag_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(0.1); RETURN NEW; END $$`.execute(
				db,
			);
			await sql`CREATE TRIGGER slow_tag_write BEFORE INSERT OR UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION slow_tag_write()`.execute(
				db,
			);
			const created = await Promise.all(
				Array.from({ length: 10 }, (_, index) =>
					db.transaction().execute(async (transaction) => {
						const tag = await createTag(transaction, {
							title: index % 2 ? " TECHNO " : "techno",
							color: index % 2 ? "#aaaaaa" : "#bbbbbb",
							mixcloud_url: `https://example.test/${index}`,
						});
						// Reuse must not abort the caller's transaction.
						await sql`SELECT 1`.execute(transaction);
						return tag;
					}),
				),
			);
			expect(new Set(created.map((tag) => tag.id)).size).toBe(1);
			for (const tag of created) expect(tag).toEqual(created[0]);
			expect((await db.selectFrom("tags").selectAll().execute()).length).toBe(
				4,
			);
			// A writer holding the publication row must be able to create B while
			// another writer is already trying B. The old AFTER trigger deadlocks.
			await sql`CREATE TABLE tag_update_probe (count integer NOT NULL)`.execute(
				db,
			);
			await sql`INSERT INTO tag_update_probe VALUES (0)`.execute(db);
			await sql`CREATE FUNCTION count_tag_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE tag_update_probe SET count = count + 1; RETURN NULL; END $$`.execute(
				db,
			);
			await sql`CREATE TRIGGER count_tag_update AFTER UPDATE ON tags FOR EACH STATEMENT EXECUTE FUNCTION count_tag_update()`.execute(
				db,
			);
			const revisionBeforeRace = await db
				.selectFrom("archive_publication_state")
				.select("revision")
				.executeTakeFirstOrThrow();
			let notifyFirst = () => {};
			let releaseFirst = () => {};
			let reportSecond = (_pid: number) => {};
			const firstReady = new Promise<void>((resolve) => {
				notifyFirst = resolve;
			});
			const resumeFirst = new Promise<void>((resolve) => {
				releaseFirst = resolve;
			});
			const secondPid = new Promise<number>((resolve) => {
				reportSecond = resolve;
			});
			const firstWriter = db.transaction().execute(async (transaction) => {
				await createTag(transaction, { title: "Lock order A" });
				notifyFirst();
				await resumeFirst;
				return createTag(transaction, { title: "Lock order B" });
			});
			await firstReady;
			const secondWriter = db.transaction().execute(async (transaction) => {
				const { rows } = await sql<{
					pid: number;
				}>`SELECT pg_backend_pid() AS pid`.execute(transaction);
				const pid = rows[0]?.pid;
				if (pid === undefined) throw new Error("Missing backend PID");
				reportSecond(pid);
				return createTag(transaction, { title: "Lock order B" });
			});
			const pid = await secondPid;
			let blocked = false;
			try {
				for (let attempt = 0; attempt < 100; attempt++) {
					const { rows } = await sql<{
						blocked: boolean;
					}>`SELECT wait_event_type = 'Lock' AS blocked FROM pg_stat_activity WHERE pid = ${pid}`.execute(
						db,
					);
					if (rows[0]?.blocked) {
						blocked = true;
						break;
					}
					await new Promise((resolve) => setTimeout(resolve, 20));
				}
			} finally {
				releaseFirst();
			}
			const [firstTag, secondTag] = await Promise.all([
				firstWriter,
				secondWriter,
			]);
			expect(blocked).toBe(true);
			expect(firstTag.id).toBe(secondTag.id);
			expect(secondTag).toEqual(firstTag);
			const revisionAfterRace = await db
				.selectFrom("archive_publication_state")
				.select("revision")
				.executeTakeFirstOrThrow();
			expect(
				BigInt(revisionAfterRace.revision) -
					BigInt(revisionBeforeRace.revision),
			).toBe(3n);
			expect(
				(
					await sql<{
						count: number;
					}>`SELECT count FROM tag_update_probe`.execute(db)
				).rows[0]?.count,
			).toBe(0);
			expect(
				await createTag(db, { title: " LOCK ORDER B ", color: "#ffffff" }),
			).toEqual(firstTag);
			expect(
				await db
					.selectFrom("archive_publication_state")
					.select("revision")
					.executeTakeFirstOrThrow(),
			).toEqual(revisionAfterRace);
			// Direct writes must respect the same trimmed, nonblank storage contract.
			const revisionBeforeRejectedWrite = await db
				.selectFrom("archive_publication_state")
				.selectAll()
				.executeTakeFirstOrThrow();
			await expect(
				sql`INSERT INTO tags (title) VALUES (${"\t\u00a0Invalid\ufeff"})`.execute(
					db,
				),
			).rejects.toThrow();
			expect(
				await db
					.selectFrom("archive_publication_state")
					.selectAll()
					.executeTakeFirstOrThrow(),
			).toEqual(revisionBeforeRejectedWrite);
			await expect(
				sql`INSERT INTO tags (title) VALUES ('')`.execute(db),
			).rejects.toThrow();
			await app.register(tagRoutes(db));
			const edits = await Promise.all(
				[1, 2].map((id) =>
					app.inject({
						method: "POST",
						url: "/modify-tag",
						payload: {
							edit_type: "partial_edit",
							id,
							title: "Collision",
							color: "#112233",
						},
					}),
				),
			);
			expect(edits.map((response) => response.statusCode).sort()).toEqual([
				200, 400,
			]);
			expect(
				edits.find((response) => response.statusCode === 400)?.json(),
			).toEqual({
				error: "Another tag already uses this title. Choose a different title.",
			});
			const rows = await db
				.selectFrom("tags")
				.selectAll()
				.where("id", "in", [1, 2])
				.execute();
			const loser = rows.find((row) => row.title !== "Collision");
			expect(loser?.color).toBe(loser?.id === 1 ? "#123456" : "#abcdef");
			expect(loser?.reviewed).toBe(false);
			await db.transaction().execute(down);
			const trigger = await sql<{
				definition: string;
			}>`SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid = 'tags'::regclass AND tgname = 'archive_publication_revision'`.execute(
				db,
			);
			expect(trigger.rows[0]?.definition).toContain(
				"AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE",
			);
			await sql`INSERT INTO tags (title) VALUES ('collision'), (' Rollback trailing ')`.execute(
				db,
			);
		} finally {
			await app.close();
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
