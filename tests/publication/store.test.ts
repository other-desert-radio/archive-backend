import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import {
	down,
	up,
} from "../../src/db/migrations/0030_add_archive_publication_jobs.js";
import {
	up as createLogs,
	down as dropLogs,
} from "../../src/db/migrations/0031_add_archive_publication_logs.js";
import type { Database } from "../../src/db/types.js";
import {
	appendPublicationLog,
	capturePublicationRevision,
	createPublicationJob,
	type PublicationConfig,
	type PublicationLease,
	pruneCompletedPublicationJobs,
	readPublicationJob,
	readPublicationJobRecord,
	recordPublicationCommit,
	sanitizePublicationLog,
	updatePublicationStage,
} from "../../src/publication/index.js";

const databaseUrl = process.env.PUBLICATION_STORE_TEST_DATABASE_URL;
const config: PublicationConfig = {
	enabled: true,
	repository: "git@github.com:other-desert-radio/archive-site.git",
	checkoutPath: "/archive-site",
	branch: "publish-dev",
};

test("publication log sanitization removes controls and redacts credentials before splitting lines", () => {
	const lines = sanitizePublicationLog({
		message: [
			"\u001b[31mFetching origin\u001b[0m\r\nProgress\rDone\u0000\u0007",
			"https://user:password@example.test/repo?access_token=hidden&next=ok",
			"Authorization: Bearer hidden-bearer",
			"password=\"two word secret\" api_key='another secret'",
			"ghp_exampletoken github_pat_exampletoken",
			"-----BEGIN OPENSSH PRIVATE KEY-----\nprivate-material\n-----END OPENSSH PRIVATE KEY-----",
			"known-value and kn\u001b[31mown-value",
		].join("\n"),
		secrets: ["", "known-value"],
	});
	expect(lines.slice(0, 3)).toEqual(["Fetching origin", "Progress", "Done"]);
	const text = lines.join("\n");
	for (const secret of [
		"user:password",
		"hidden",
		"two word secret",
		"another secret",
		"ghp_exampletoken",
		"github_pat_exampletoken",
		"private-material",
		"known-value",
		"\u001b",
		"\u0000",
		"\u0007",
	])
		expect(text).not.toContain(secret);
	expect(text).toContain(
		"https://[REDACTED]@example.test/repo?access_token=[REDACTED]&next=ok",
	);
	expect(text).toContain("[REDACTED PRIVATE KEY]");
	expect(sanitizePublicationLog({ message: " \n\r\n" })).toEqual([]);
	expect(
		sanitizePublicationLog({
			message: "-----BEGIN RSA PRIVATE KEY-----\nunclosed-secret",
		}),
	).toEqual(["[REDACTED PRIVATE KEY]"]);
});

test.skipIf(!databaseUrl)(
	"publication logs are ordered, bounded, sanitized, transactional, and cascade with completed-job retention",
	async () => {
		const schema = `publication_logs_${crypto.randomUUID().replaceAll("-", "")}`;
		const database = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		const lease: PublicationLease = {
			database,
			release: () => database.destroy(),
		};
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(database);
			await database.transaction().execute(up);
			await expect(
				database.transaction().execute(async (transaction) => {
					await createLogs(transaction);
					throw new Error("rollback log schema");
				}),
			).rejects.toThrow("rollback log schema");
			await database.transaction().execute(createLogs);
			const job = await createPublicationJob({
				lease,
				request: { requestedBy: "admin" },
				config,
			});
			expect(await readPublicationJob(database, job.id)).toEqual({
				job,
				logs: [],
				logsTruncated: false,
			});
			expect(
				await readPublicationJob(database, crypto.randomUUID()),
			).toBeUndefined();
			await appendPublicationLog(
				lease,
				job.id,
				"first\npassword=hidden\nknown-value",
				["known-value"],
			);
			await Promise.all(
				Array.from({ length: 7 }, (_, index) =>
					appendPublicationLog(lease, job.id, `parallel ${index}`),
				),
			);
			const initial = await readPublicationJob(database, job.id);
			expect(initial?.logs.map((line) => line.sequence)).toEqual(
				Array.from({ length: 10 }, (_, index) => index + 1),
			);
			expect(initial?.logs.slice(0, 3).map((line) => line.message)).toEqual([
				"first",
				"password=[REDACTED]",
				"[REDACTED]",
			]);
			expect(
				initial?.logs.every(
					(line) => !Number.isNaN(Date.parse(line.timestamp)),
				),
			).toBe(true);
			expect(
				(
					await database
						.selectFrom("archive_publication_logs")
						.select("message")
						.execute()
				)
					.map((line) => line.message)
					.join("\n"),
			).not.toContain("hidden");
			await sql`ALTER TABLE archive_publication_logs ADD CONSTRAINT reject_test_line CHECK (message <> 'reject-me')`.execute(
				database,
			);
			await expect(
				appendPublicationLog(lease, job.id, "would-be-inserted\nreject-me"),
			).rejects.toThrow();
			expect((await readPublicationJob(database, job.id))?.logs).toEqual(
				initial?.logs,
			);
			await sql`ALTER TABLE archive_publication_logs DROP CONSTRAINT reject_test_line`.execute(
				database,
			);
			await appendPublicationLog(
				lease,
				job.id,
				Array.from({ length: 1990 }, (_, index) => `line ${index}`).join("\n"),
			);
			const full = await readPublicationJob(database, job.id);
			expect(full?.logs).toHaveLength(2000);
			expect(full?.logsTruncated).toBe(false);
			await appendPublicationLog(
				lease,
				job.id,
				"overflow 1\noverflow 2\noverflow 3\noverflow 4\noverflow 5",
			);
			const truncated = await readPublicationJob(database, job.id);
			expect(truncated?.logs).toHaveLength(2000);
			expect(truncated?.logsTruncated).toBe(true);
			expect(truncated?.logs[0]?.sequence).toBe(0);
			expect(truncated?.logs[0]?.message).toContain("truncated");
			expect(truncated?.logs[1]?.sequence).toBe(7);
			expect(truncated?.logs.at(-1)).toMatchObject({
				sequence: 2005,
				message: "overflow 5",
			});
			await appendPublicationLog(
				lease,
				job.id,
				Array.from({ length: 4001 }, (_, index) => `large batch ${index}`).join(
					"\n",
				),
			);
			const large = await readPublicationJob(database, job.id);
			expect(large?.logs).toHaveLength(2000);
			expect(large?.logs[0]).toEqual(truncated?.logs[0]);
			expect(large?.logs[1]?.message).toBe("large batch 2002");
			expect(large?.logs.at(-1)?.sequence).toBe(6006);
			await expect(
				appendPublicationLog(lease, crypto.randomUUID(), "missing"),
			).rejects.toThrow();
			await expect(
				database
					.insertInto("archive_publication_logs")
					.values({
						job_id: crypto.randomUUID(),
						sequence: 1,
						message: "orphan",
					})
					.execute(),
			).rejects.toThrow();
			await expect(
				database
					.insertInto("archive_publication_logs")
					.values({ job_id: job.id, sequence: -1, message: "invalid sequence" })
					.execute(),
			).rejects.toThrow();
			const completedIds: string[] = [];
			for (let index = 1; index <= 25; index++) {
				const id = `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`;
				completedIds.push(id);
				await database
					.insertInto("archive_publication_jobs")
					.values({
						id,
						requested_by: "admin",
						repository: config.repository,
						checkout_path: config.checkoutPath,
						branch: config.branch,
						retry_job_id: null,
						revision: null,
						commit_id: null,
						error: null,
						completed_at: null,
						created_at: new Date("2026-01-01T00:00:00Z"),
					})
					.execute();
				await appendPublicationLog(lease, id, "completed job log");
				await database
					.updateTable("archive_publication_jobs")
					.set({
						outcome: "interrupted",
						completed_at: new Date("2026-01-02T00:00:00Z"),
					})
					.where("id", "=", id)
					.execute();
			}
			await expect(
				appendPublicationLog(lease, completedIds[0] ?? "", "late"),
			).rejects.toThrow();
			await expect(
				database.transaction().execute(async (transaction) => {
					expect(
						await pruneCompletedPublicationJobs({
							...lease,
							database: transaction,
						}),
					).toBe(5);
					throw new Error("rollback retention");
				}),
			).rejects.toThrow("rollback retention");
			expect(
				await readPublicationJob(database, completedIds[0] ?? ""),
			).toBeDefined();
			expect(await pruneCompletedPublicationJobs(lease)).toBe(5);
			expect(await pruneCompletedPublicationJobs(lease)).toBe(0);
			expect(
				(
					await database
						.selectFrom("archive_publication_jobs")
						.select("id")
						.where("outcome", "!=", "running")
						.orderBy("id")
						.execute()
				).map((row) => row.id),
			).toEqual(completedIds.slice(5));
			expect((await readPublicationJob(database, job.id))?.logs).toHaveLength(
				2000,
			);
			expect(
				await readPublicationJob(database, completedIds[0] ?? ""),
			).toBeUndefined();
			expect(
				await database
					.selectFrom("archive_publication_logs")
					.select("job_id")
					.where("job_id", "!=", job.id)
					.execute(),
			).toHaveLength(20);
			const beforeSnapshot = await readPublicationJob(database, job.id);
			let interleaved = false;
			const snapshotReader = database.withPlugin({
				transformQuery: ({ node }) => node,
				transformResult: async ({ result }) => {
					if (
						!interleaved &&
						result.rows.some((row) => "requested_by" in row)
					) {
						interleaved = true;
						await appendPublicationLog(
							lease,
							job.id,
							"committed after snapshot",
						);
						await database
							.updateTable("archive_publication_jobs")
							.set({ outcome: "interrupted", completed_at: new Date() })
							.where("id", "=", job.id)
							.execute();
					}
					return result;
				},
			});
			expect(await readPublicationJob(snapshotReader, job.id)).toEqual(
				beforeSnapshot,
			);
			const afterSnapshot = await readPublicationJob(database, job.id);
			expect(afterSnapshot?.job.outcome).toBe("interrupted");
			expect(afterSnapshot?.logs.at(-1)?.message).toBe(
				"committed after snapshot",
			);
			await database.transaction().execute(dropLogs);
			expect(await readPublicationJobRecord(database, job.id)).toBeDefined();
			await database.transaction().execute(createLogs);
			expect((await readPublicationJob(database, job.id))?.logs).toEqual([]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(
				database,
			);
			await lease.release();
		}
	},
);

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
