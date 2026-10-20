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
	acquirePublicationLease,
	appendPublicationLog,
	capturePublicationRevision,
	createPublicationJob,
	interruptAbandonedPublications,
	PublicationBusyError,
	type PublicationConfig,
	type PublicationLease,
	pruneCompletedPublicationJobs,
	readPublicationJob,
	readPublicationJobRecord,
	recordPublicationCommit,
	reservePublicationJob,
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

test.skipIf(!databaseUrl)(
	"startup interruption requires an owned lease, preserves recovery metadata, and never retries",
	async () => {
		const schema = `publication_restart_${crypto.randomUUID().replaceAll("-", "")}`;
		const connect = () =>
			new Kysely<Database>({
				dialect: new PostgresDialect({
					pool: new Pool({
						connectionString: databaseUrl,
						options: `-c search_path=${schema}`,
					}),
				}),
			});
		const previous = connect();
		const restarted = connect();
		const leases: PublicationLease[] = [];
		const own = async (database: Kysely<Database>) => {
			const lease = await acquirePublicationLease(database);
			if (lease === undefined) throw new Error("Expected startup lease");
			leases.push(lease);
			return lease;
		};
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(previous);
			await previous.transaction().execute(up);
			await previous.transaction().execute(createLogs);
			await sql`CREATE TABLE archive_publication_state (id integer, revision bigint, published_revision bigint)`.execute(
				previous,
			);
			await sql`INSERT INTO archive_publication_state VALUES (1, 9, 3)`.execute(
				previous,
			);
			const reservation = await reservePublicationJob({
				database: previous,
				request: { requestedBy: "original-admin" },
				config,
			});
			leases.push(reservation.lease);
			await capturePublicationRevision(
				reservation.lease,
				reservation.job.id,
				"7",
			);
			await recordPublicationCommit(
				reservation.lease,
				reservation.job.id,
				"a".repeat(40),
			);
			await updatePublicationStage(
				reservation.lease,
				reservation.job.id,
				"pushing",
			);
			await appendPublicationLog(
				reservation.lease,
				reservation.job.id,
				"Commit created; push not confirmed",
			);
			const queued = await createPublicationJob({
				lease: reservation.lease,
				request: { requestedBy: "queued-admin" },
				config,
			});
			await reservation.lease.database
				.insertInto("archive_publication_jobs")
				.values(
					Array.from({ length: 21 }, () => ({
						id: crypto.randomUUID(),
						requested_by: "historical-admin",
						repository: config.repository,
						checkout_path: config.checkoutPath,
						branch: config.branch,
						retry_job_id: null,
						revision: null,
						commit_id: null,
						error: "Earlier failure",
						outcome: "failed" as const,
						created_at: new Date("2026-01-01T00:00:00Z"),
						completed_at: new Date("2026-01-02T00:00:00Z"),
					})),
				)
				.execute();
			const before = await readPublicationJob(
				reservation.lease.database,
				reservation.job.id,
			);
			expect(await acquirePublicationLease(restarted)).toBeUndefined();
			await expect(
				interruptAbandonedPublications({
					database: restarted,
					release: () => restarted.destroy(),
				}),
			).rejects.toThrow("active publication lease");
			expect(
				(await readPublicationJobRecord(restarted, reservation.job.id))
					?.outcome,
			).toBe("running");
			await reservation.lease.release();
			await expect(
				interruptAbandonedPublications(reservation.lease),
			).rejects.toThrow("active publication lease");
			await expect(
				reservePublicationJob({
					database: restarted,
					request: { requestedBy: "new-admin" },
					config,
				}),
			).rejects.toBeInstanceOf(PublicationBusyError);
			// A failure after UPDATE must roll back interruption together with retention.
			const failingDatabase = restarted.withPlugin({
				transformQuery: ({ node }) => {
					if (node.kind === "DeleteQueryNode")
						throw new Error("retention unavailable");
					return node;
				},
				transformResult: async ({ result }) => result,
			});
			const failingLease = await own(failingDatabase);
			await expect(
				interruptAbandonedPublications(failingLease),
			).rejects.toThrow("retention unavailable");
			await failingLease.release();
			expect(await readPublicationJob(restarted, reservation.job.id)).toEqual(
				before,
			);
			const recovery = await own(restarted);
			await interruptAbandonedPublications(recovery);
			const after = await readPublicationJob(
				recovery.database,
				reservation.job.id,
			);
			expect(after?.job).toMatchObject({
				...before?.job,
				outcome: "interrupted",
				error: "Publication interrupted by backend restart. Retry explicitly.",
			});
			expect(after?.job).toHaveProperty("completedAt");
			expect(after?.logs).toEqual(before?.logs);
			expect(after?.logsTruncated).toBe(before?.logsTruncated);
			expect(
				(await readPublicationJobRecord(recovery.database, queued.id))?.outcome,
			).toBe("interrupted");
			expect(
				(
					await recovery.database
						.selectFrom("archive_publication_jobs")
						.selectAll()
						.where("outcome", "=", "failed")
						.execute()
				).every(
					(row) =>
						row.error === "Earlier failure" &&
						row.completed_at?.toISOString() === "2026-01-02T00:00:00.000Z",
				),
			).toBe(true);
			expect(
				await recovery.database
					.selectFrom("archive_publication_jobs")
					.select("id")
					.execute(),
			).toHaveLength(10);
			expect(
				await recovery.database
					.selectFrom("archive_publication_jobs")
					.select("id")
					.where("outcome", "=", "running")
					.execute(),
			).toEqual([]);
			expect(
				await recovery.database
					.selectFrom("archive_publication_state")
					.selectAll()
					.execute(),
			).toEqual([{ id: 1, revision: "9", published_revision: "3" }]);
			await interruptAbandonedPublications(recovery);
			expect(
				await readPublicationJob(recovery.database, reservation.job.id),
			).toEqual(after);
			await recovery.release();
			// Recovery creates no job; only a later explicit reservation starts a retry.
			const retry = await reservePublicationJob({
				database: restarted,
				request: { requestedBy: "new-admin", retryJobId: queued.id },
				config,
			});
			leases.push(retry.lease);
			expect(retry.job.retryJobId).toBe(queued.id);
			expect(retry.job.outcome).toBe("running");
			await retry.lease.release();
		} finally {
			await Promise.all(leases.map((lease) => lease.release()));
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(
				previous,
			);
			await Promise.all([previous.destroy(), restarted.destroy()]);
		}
	},
);

test.skipIf(!databaseUrl)(
	"publication leases pin connections, reject concurrent starts, and release on failed reservations",
	async () => {
		const schema = `publication_lock_${crypto.randomUUID().replaceAll("-", "")}`;
		const connect = () =>
			new Kysely<Database>({
				dialect: new PostgresDialect({
					pool: new Pool({
						connectionString: databaseUrl,
						max: 1,
						options: `-c search_path=${schema}`,
					}),
				}),
			});
		const first = connect();
		const second = connect();
		const leases: PublicationLease[] = [];
		const acquire = async (database: Kysely<Database>) => {
			const lease = await acquirePublicationLease(database);
			if (lease === undefined)
				throw new Error("Expected an available publication lease");
			leases.push(lease);
			return lease;
		};
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(first);
			await expect(
				reservePublicationJob({
					database: first,
					request: { requestedBy: "admin" },
					config,
				}),
			).rejects.toThrow();
			const lease = await acquire(first);
			const backend = await sql<{
				pid: number;
			}>`SELECT pg_backend_pid() AS pid`.execute(lease.database);
			expect(await acquirePublicationLease(second)).toBeUndefined();
			// A failed try-lock returns its connection to a one-connection pool.
			expect((await sql`SELECT 1`.execute(second)).rows).toHaveLength(1);
			await lease.database.transaction().execute(up);
			expect(
				(
					await sql<{ pid: number }>`SELECT pg_backend_pid() AS pid`.execute(
						lease.database,
					)
				).rows,
			).toEqual(backend.rows);
			await lease.release();
			const reacquired = await acquire(first);
			await lease.release();
			expect(await acquirePublicationLease(second)).toBeUndefined();
			await reacquired.release();
			await first.transaction().execute(async (transaction) => {
				await expect(acquirePublicationLease(transaction)).rejects.toThrow(
					"outside a transaction",
				);
			});
			await expect(
				reservePublicationJob({
					database: first,
					request: { requestedBy: "admin" },
					config: { ...config, enabled: false },
				}),
			).rejects.toThrow("disabled");
			await expect(
				reservePublicationJob({
					database: first,
					request: { requestedBy: " " },
					config,
				}),
			).rejects.toThrow();
			// Independent connections race without sleeps: exactly one reserves a durable job.
			const results = await Promise.allSettled(
				[first, second].map((database) =>
					reservePublicationJob({
						database,
						request: { requestedBy: "admin" },
						config,
					}),
				),
			);
			const winners = results.filter((result) => result.status === "fulfilled");
			const losers = results.filter((result) => result.status === "rejected");
			expect(winners).toHaveLength(1);
			expect(losers).toHaveLength(1);
			expect(losers[0]?.reason).toBeInstanceOf(PublicationBusyError);
			const winner = winners[0]?.value;
			if (winner === undefined) throw new Error("Expected one reservation");
			leases.push(winner.lease);
			const observer = results[0]?.status === "fulfilled" ? second : first;
			expect(await readPublicationJobRecord(observer, winner.job.id)).toEqual(
				winner.job,
			);
			await updatePublicationStage(winner.lease, winner.job.id, "exporting");
			await capturePublicationRevision(winner.lease, winner.job.id, "5");
			expect(
				(await readPublicationJobRecord(observer, winner.job.id))?.revision,
			).toBe("5");
			await expect(
				reservePublicationJob({
					database: observer,
					request: { requestedBy: "admin" },
					config,
				}),
			).rejects.toBeInstanceOf(PublicationBusyError);
			await winner.lease.release();
			// A durable running row blocks a new start even when no session holds the lock.
			await expect(
				reservePublicationJob({
					database: observer,
					request: { requestedBy: "admin" },
					config,
				}),
			).rejects.toBeInstanceOf(PublicationBusyError);
			expect(
				await observer
					.selectFrom("archive_publication_jobs")
					.select("id")
					.execute(),
			).toHaveLength(1);
			const afterRejection = await acquire(observer);
			await afterRejection.release();
			await observer
				.updateTable("archive_publication_jobs")
				.set({ outcome: "interrupted", completed_at: new Date() })
				.where("id", "=", winner.job.id)
				.execute();
			const retry = await reservePublicationJob({
				database: observer,
				request: { requestedBy: "admin", retryJobId: winner.job.id },
				config,
			});
			leases.push(retry.lease);
			expect(retry.job.retryJobId).toBe(winner.job.id);
			expect(retry.job.id).not.toBe(winner.job.id);
			await retry.lease.release();
		} finally {
			await Promise.all(leases.map((lease) => lease.release()));
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(first);
			await Promise.all([first.destroy(), second.destroy()]);
		}
	},
);

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
					).toBe(15);
					throw new Error("rollback retention");
				}),
			).rejects.toThrow("rollback retention");
			expect(
				await readPublicationJob(database, completedIds[0] ?? ""),
			).toBeDefined();
			expect(await pruneCompletedPublicationJobs(lease)).toBe(15);
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
			).toEqual(completedIds.slice(15));
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
			).toHaveLength(10);
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
		// Metadata storage is tested independently; reservation has its own coverage.
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
