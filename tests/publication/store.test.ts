import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import {
	down,
	up,
} from "../../src/db/migrations/0030_add_archive_publication_jobs.js";
import type { Database } from "../../src/db/types.js";
import {
	capturePublicationRevision,
	createPublicationJob,
	type PublicationConfig,
	type PublicationLease,
	readPublicationJobRecord,
	recordPublicationCommit,
	updatePublicationStage,
} from "../../src/publication/index.js";

const databaseUrl = process.env.PUBLICATION_STORE_TEST_DATABASE_URL;
const config: PublicationConfig = {
	enabled: true,
	repository: "git@github.com:other-desert-radio/archive-site.git",
	checkoutPath: "/archive-site",
	branch: "publish-dev",
};

test.skipIf(!databaseUrl)(
	"durable publication jobs persist progress across connections and preserve archive state on rollback",
	async () => {
		const schema = `publication_jobs_${crypto.randomUUID().replaceAll("-", "")}`;
		const connect = () =>
			new Kysely<Database>({
				dialect: new PostgresDialect({
					pool: new Pool({
						connectionString: databaseUrl,
						options: `-c search_path=${schema}`,
					}),
				}),
			});
		const database = connect();
		// Storage is tested independently of the not-yet-implemented admission lock.
		const lease: PublicationLease = {
			database,
			release: () => database.destroy(),
		};
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(database);
			await sql`CREATE TABLE archive_publication_state (id integer, revision bigint, published_revision bigint)`.execute(
				database,
			);
			await sql`INSERT INTO archive_publication_state VALUES (1, 9007199254740993, 0)`.execute(
				database,
			);
			await expect(
				database.transaction().execute(async (transaction) => {
					await up(transaction);
					throw new Error("rollback schema creation");
				}),
			).rejects.toThrow("rollback schema creation");
			expect(
				(
					await sql<{
						table: string | null;
					}>`SELECT to_regclass('archive_publication_jobs')::text AS table`.execute(
						database,
					)
				).rows,
			).toEqual([{ table: null }]);
			await database.transaction().execute(up);
			const job = await createPublicationJob({
				lease,
				request: { requestedBy: "admin-id" },
				config,
			});
			expect(job).toMatchObject({
				requestedBy: "admin-id",
				target: {
					repository: config.repository,
					checkoutPath: config.checkoutPath,
					branch: config.branch,
				},
				outcome: "running",
				stage: "queued",
			});
			expect(job.id).toMatch(/^[0-9a-f-]{36}$/);
			expect(Number.isNaN(Date.parse(job.createdAt))).toBe(false);
			expect(job).not.toHaveProperty("revision");
			expect(job).not.toHaveProperty("commitId");
			expect(job).not.toHaveProperty("completedAt");
			expect(job).not.toHaveProperty("error");
			expect(job).not.toHaveProperty("retryJobId");
			expect(
				await readPublicationJobRecord(database, crypto.randomUUID()),
			).toBeUndefined();
			await updatePublicationStage(lease, job.id, "exporting");
			await capturePublicationRevision(lease, job.id, "9007199254740993");
			await expect(
				capturePublicationRevision(lease, job.id, "10"),
			).rejects.toThrow();
			for (const revision of [
				"0",
				"-1",
				"1.5",
				"1e3",
				"01",
				" 1",
				"9223372036854775808",
			]) {
				await expect(
					capturePublicationRevision(lease, job.id, revision),
				).rejects.toThrow();
			}
			await updatePublicationStage(lease, job.id, "pushing");
			const commitId = "a".repeat(40);
			await recordPublicationCommit(lease, job.id, commitId);
			await expect(
				recordPublicationCommit(lease, job.id, "b".repeat(40)),
			).rejects.toThrow();
			await expect(
				recordPublicationCommit(lease, job.id, "short"),
			).rejects.toThrow();
			const reader = connect();
			try {
				expect(await readPublicationJobRecord(reader, job.id)).toEqual({
					...job,
					stage: "pushing",
					revision: "9007199254740993",
					commitId,
				});
			} finally {
				await reader.destroy();
			}
			const retry = await createPublicationJob({
				lease,
				request: { requestedBy: "another-admin", retryJobId: job.id },
				config: { ...config, branch: "main" },
			});
			expect(retry.id).not.toBe(job.id);
			expect(retry.retryJobId).toBe(job.id);
			expect(retry.target.branch).toBe("main");
			expect(
				(await readPublicationJobRecord(database, job.id))?.target.branch,
			).toBe("publish-dev");
			await expect(
				recordPublicationCommit(lease, retry.id, commitId),
			).rejects.toThrow();
			await expect(
				updatePublicationStage(lease, crypto.randomUUID(), "pushing"),
			).rejects.toThrow();
			// Completion orchestration is deferred; exercise schema invariants directly.
			for (const statement of [
				sql`UPDATE archive_publication_jobs SET stage = 'unknown' WHERE id = ${job.id}`,
				sql`UPDATE archive_publication_jobs SET outcome = 'unknown' WHERE id = ${job.id}`,
				sql`UPDATE archive_publication_jobs SET outcome = 'failed' WHERE id = ${job.id}`,
				sql`UPDATE archive_publication_jobs SET completed_at = now() WHERE id = ${job.id}`,
				sql`UPDATE archive_publication_jobs SET revision = 0 WHERE id = ${job.id}`,
				sql`UPDATE archive_publication_jobs SET error = 'failure' WHERE id = ${job.id}`,
				sql`UPDATE archive_publication_jobs SET outcome = 'succeeded', completed_at = now() WHERE id = ${retry.id}`,
			])
				await expect(statement.execute(database)).rejects.toThrow();
			await expect(
				createPublicationJob({ lease, request: { requestedBy: " " }, config }),
			).rejects.toThrow();
			await database
				.updateTable("archive_publication_jobs")
				.set({ outcome: "succeeded", completed_at: new Date() })
				.where("id", "=", job.id)
				.execute();
			const completed = await readPublicationJobRecord(database, job.id);
			expect(completed?.outcome).toBe("succeeded");
			expect(completed).toHaveProperty("completedAt");
			await expect(
				updatePublicationStage(lease, job.id, "queued"),
			).rejects.toThrow();
			await expect(
				capturePublicationRevision(lease, job.id, "11"),
			).rejects.toThrow();
			await expect(
				recordPublicationCommit(lease, job.id, "c".repeat(40)),
			).rejects.toThrow();
			await database
				.updateTable("archive_publication_jobs")
				.set({
					outcome: "failed",
					completed_at: new Date(),
					error: "Safe failure summary",
				})
				.where("id", "=", retry.id)
				.execute();
			expect(await readPublicationJobRecord(database, retry.id)).toMatchObject({
				outcome: "failed",
				error: "Safe failure summary",
			});
			const before = await database
				.selectFrom("archive_publication_state")
				.selectAll()
				.execute();
			await expect(
				database.transaction().execute(async (transaction) => {
					await createPublicationJob({
						lease: { ...lease, database: transaction },
						request: { requestedBy: "rolled-back-admin" },
						config,
					});
					throw new Error("rollback job creation");
				}),
			).rejects.toThrow("rollback job creation");
			expect(
				await database
					.selectFrom("archive_publication_jobs")
					.select("id")
					.execute(),
			).toHaveLength(2);
			await database.transaction().execute(down);
			expect(
				await database
					.selectFrom("archive_publication_state")
					.selectAll()
					.execute(),
			).toEqual(before);
			await database.transaction().execute(up);
			expect(
				await database
					.selectFrom("archive_publication_jobs")
					.selectAll()
					.execute(),
			).toEqual([]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(
				database,
			);
			await lease.release();
		}
	},
);
