import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createDJs } from "../../src/db/migrations/0001_create_djs_table.js";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as createTags } from "../../src/db/migrations/0003_create_tags_table.js";
import { up as createShowDJs } from "../../src/db/migrations/0004_create_show_djs_table.js";
import { up as createShowTags } from "../../src/db/migrations/0005_create_show_tags_table.js";
import { up as createDJTags } from "../../src/db/migrations/0006_create_dj_tags_table.js";
import { up as createState } from "../../src/db/migrations/0029_add_archive_publication_state.js";
import { up as createJobs } from "../../src/db/migrations/0030_add_archive_publication_jobs.js";
import {
	down,
	up,
} from "../../src/db/migrations/0033_add_publication_modes.js";
import type { Database } from "../../src/db/types.js";
import { readPublicationJobRecord } from "../../src/publication/index.js";

const databaseUrl = process.env.PUBLICATION_MIGRATION_TEST_DATABASE_URL;

const withDatabase = async (run: (db: Kysely<Database>) => Promise<void>) => {
	const schema = `publication_modes_${crypto.randomUUID().replaceAll("-", "")}`;
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
		for (const create of [
			createDJs,
			createShows,
			createTags,
			createShowDJs,
			createShowTags,
			createDJTags,
			createState,
			createJobs,
		]) {
			await db.transaction().execute(create);
		}
		await run(db);
	} finally {
		await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
		await db.destroy();
	}
};

const remoteJob = () => ({
	id: crypto.randomUUID(),
	requested_by: "admin",
	repository: "git@example.test:archive.git",
	checkout_path: "/archive-site",
	branch: "main",
	retry_job_id: null,
	completed_at: null,
	revision: null,
	commit_id: null,
	error: null,
});

test.skipIf(!databaseUrl)(
	"publication mode migration preserves remote history and acknowledged destination through rollback",
	async () => {
		await withDatabase(async (db) => {
			const original = await db
				.insertInto("archive_publication_jobs")
				.values({
					...remoteJob(),
					revision: "1",
					commit_id: "a".repeat(40),
					outcome: "succeeded",
					stage: "acknowledging",
					completed_at: new Date(),
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			await db
				.updateTable("archive_publication_state")
				.set({ published_revision: "1" })
				.execute();
			await db.transaction().execute(up);
			const migrated = await db
				.selectFrom("archive_publication_jobs")
				.selectAll()
				.executeTakeFirstOrThrow();
			expect(migrated).toEqual({ ...original, mode: "remote" });
			const state = await db
				.selectFrom("archive_publication_state")
				.selectAll()
				.executeTakeFirstOrThrow();
			expect(state).toEqual({
				id: 1,
				revision: "1",
				published_revision: "1",
				published_target: {
					mode: "remote",
					checkoutPath: original.checkout_path,
					repository: original.repository,
					branch: original.branch,
				},
			});
			expect((await readPublicationJobRecord(db, original.id))?.target).toEqual(
				state.published_target,
			);
			await db.transaction().execute(down);
			expect(
				await db.selectFrom("archive_publication_jobs").selectAll().execute(),
			).toEqual([original]);
			expect(
				await db
					.selectFrom("archive_publication_state")
					.selectAll()
					.executeTakeFirstOrThrow(),
			).toEqual({ id: 1, revision: "1", published_revision: "1" });
			await expect(
				db
					.insertInto("archive_publication_jobs")
					.values({ ...remoteJob(), repository: null })
					.execute(),
			).rejects.toThrow();
			await db.transaction().execute(up);
			expect(
				(await db.selectFrom("archive_publication_jobs").selectAll().execute())
					.length,
			).toBe(1);
		});
	},
);

test.skipIf(!databaseUrl)(
	"publication modes allow optional local Git metadata and commit-free success while preserving remote constraints",
	async () => {
		await withDatabase(async (db) => {
			await db.transaction().execute(up);
			for (const metadata of [
				{ repository: null, branch: null },
				{ repository: "git@example.test:archive.git", branch: "feature/local" },
				{ repository: null, branch: "feature/no-origin" },
				{ repository: "git@example.test:archive.git", branch: null },
			]) {
				const local = await db
					.insertInto("archive_publication_jobs")
					.values({
						...remoteJob(),
						...metadata,
						mode: "local",
						revision: "1",
						outcome: "succeeded",
						stage: "acknowledging",
						completed_at: new Date(),
					})
					.returningAll()
					.executeTakeFirstOrThrow();
				expect((await readPublicationJobRecord(db, local.id))?.target).toEqual({
					mode: "local",
					checkoutPath: "/archive-site",
					...(metadata.repository === null
						? {}
						: { repository: metadata.repository }),
					...(metadata.branch === null ? {} : { branch: metadata.branch }),
				});
			}
			for (const invalid of [
				{ mode: "invalid" },
				{ repository: null },
				{ branch: null },
				{ mode: "local", repository: " " },
				{ mode: "local", branch: " " },
				{
					outcome: "succeeded",
					revision: "1",
					completed_at: new Date(),
				},
				{ mode: "local", outcome: "succeeded", completed_at: new Date() },
			]) {
				await expect(
					db
						.insertInto("archive_publication_jobs")
						.values({ ...remoteJob(), ...invalid })
						.execute(),
				).rejects.toThrow();
			}
			await expect(db.transaction().execute(down)).rejects.toThrow(
				"local publication jobs exist",
			);
			expect(
				await db.selectFrom("archive_publication_jobs").selectAll().execute(),
			).toHaveLength(4);
		});
	},
);

test.skipIf(!databaseUrl)(
	"acknowledged targets validate their shape and unknown history stays unknown",
	async () => {
		await withDatabase(async (db) => {
			await db.transaction().execute(up);
			const state = () =>
				db
					.selectFrom("archive_publication_state")
					.selectAll()
					.executeTakeFirstOrThrow();
			expect((await state()).published_target).toBeNull();
			const setTarget = (target: unknown) =>
				sql`UPDATE archive_publication_state SET published_target = ${JSON.stringify(target)}::jsonb`.execute(
					db,
				);
			for (const invalid of [
				null,
				"local",
				[],
				{},
				{ mode: "invalid", checkoutPath: "/archive-site" },
				{ mode: "local" },
				{ mode: "local", checkoutPath: " " },
				{ mode: "local", checkoutPath: 123 },
				{ mode: "local", checkoutPath: "/archive-site", branch: null },
				{ mode: "local", checkoutPath: "/archive-site", repository: "" },
				{ mode: "remote", checkoutPath: "/archive-site" },
			]) {
				await expect(setTarget(invalid)).rejects.toThrow();
			}
			for (const target of [
				{ mode: "local", checkoutPath: "/archive-site" },
				{
					mode: "local",
					checkoutPath: "/archive-site",
					repository: "git@example.test:archive.git",
					branch: "feature/local",
				},
				{
					mode: "remote",
					checkoutPath: "/archive-site",
					repository: "git@example.test:archive.git",
					branch: "main",
				},
			]) {
				await setTarget(target);
				expect((await state()).published_target).toEqual(target);
			}
			await setTarget({ mode: "local", checkoutPath: "/archive-site" });
			await expect(db.transaction().execute(down)).rejects.toThrow(
				"acknowledged target is local",
			);
			await db
				.updateTable("archive_publication_state")
				.set({ published_target: null })
				.execute();
			await db.transaction().execute(down);
		});
	},
);
