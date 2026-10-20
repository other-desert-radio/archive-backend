import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as revisions } from "../../src/db/migrations/0029_add_archive_publication_state.js";
import { up as jobs } from "../../src/db/migrations/0030_add_archive_publication_jobs.js";
import { up as logs } from "../../src/db/migrations/0031_add_archive_publication_logs.js";
import { up as notifications } from "../../src/db/migrations/0032_notify_publication_jobs.js";
import type { Database } from "../../src/db/types.js";
import {
	acquirePublicationLease,
	capturePublicationRevision,
	completePublicationJob,
	createPublicationRunner,
	type PublicationConfig,
	type PublicationRunner,
	readPublicationJob,
	reservePublicationJob,
} from "../../src/publication/index.js";

const execute = promisify(execFile);
const databaseUrl = process.env.PUBLICATION_RUNNER_TEST_DATABASE_URL;

const fixture = async ({ newBranch = false }: { newBranch?: boolean } = {}) => {
	const directory = await mkdtemp(path.join(tmpdir(), "publication-runner-"));
	const schema = `runner_${crypto.randomUUID().replaceAll("-", "")}`;
	const database = new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: new Pool({
				connectionString: databaseUrl,
				options: `-c search_path=${schema}`,
			}),
		}),
	});
	const checkout = path.join(directory, "checkout");
	const remote = path.join(directory, "remote.git");
	await mkdir(path.join(checkout, "src/res/djs"), { recursive: true });
	await mkdir(path.join(checkout, "public/assets/djs"), { recursive: true });
	const git = async (...args: string[]) =>
		(
			await execute("git", ["-C", checkout, ...args], {
				env: {
					...Object.fromEntries(
						Object.entries(process.env).filter(
							([name]) => !name.startsWith("GIT_"),
						),
					),
					GIT_CONFIG_GLOBAL: "/dev/null",
					GIT_CONFIG_NOSYSTEM: "1",
				},
			})
		).stdout.trim();
	await git("init", "--initial-branch=main");
	await git("config", "user.name", "Publication Runner");
	await git("config", "user.email", "runner@example.test");
	await git("config", "core.hooksPath", "/dev/null");
	await writeFile(
		path.join(checkout, "src/res/mixcloud.json"),
		"unrelated resource\n",
	);
	await writeFile(
		path.join(checkout, "public/assets/logo.svg"),
		"unrelated asset\n",
	);
	await writeFile(path.join(checkout, "src/res/djs/99.json"), "stale");
	await writeFile(
		path.join(checkout, "public/assets/djs/99_small.webp"),
		"stale",
	);
	await git("add", "--all");
	await git("commit", "-m", "Baseline");
	await git("init", "--bare", remote);
	await git("remote", "add", "origin", remote);
	await git("push", "origin", "main");
	await git("switch", "-c", "publish-dev");
	if (!newBranch) await git("push", "origin", "publish-dev");
	await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(database);
	await sql`CREATE TABLE djs (id integer, title text, bio text, image_small bytea, image_large bytea, socials text, "showTitle" text, "showDescription" text);
	CREATE TABLE shows (id integer, title text, date timestamptz, duration integer, image_small text, image_large text, url text);
	CREATE TABLE tags (id integer, title text, color text, mixcloud_key text, mixcloud_url text);
	CREATE TABLE show_djs (dj_id integer, show_id integer);
	CREATE TABLE dj_tags (dj_id integer, tag_id integer);
	CREATE TABLE show_tags (show_id integer, tag_id integer);
	INSERT INTO djs VALUES (1, 'Runner DJ', '<p>Bio</p>', decode('736d616c6c', 'hex'), decode('6c61726765', 'hex'), NULL, NULL, NULL);
	INSERT INTO shows VALUES (1, 'Runner Show', '2026-01-01', 60, 'https://example.test/small', 'https://example.test/large', 'https://example.test/audio');
	INSERT INTO tags VALUES (1, 'Original Tag', '#cccccc', NULL, NULL);
	INSERT INTO show_djs VALUES (1, 1);
	INSERT INTO show_tags VALUES (1, 1)`.execute(database);
	for (const migration of [revisions, jobs, logs, notifications])
		await database.transaction().execute(migration);
	const config: PublicationConfig = {
		enabled: true,
		repository: remote,
		checkoutPath: checkout,
		branch: "publish-dev",
	};
	const runners: PublicationRunner[] = [];
	return {
		database,
		config,
		git,
		directory,
		checkout,
		remote,
		create: async (source = database) => {
			const runner = await createPublicationRunner(source, config);
			runners.push(runner);
			return runner;
		},
		close: async () => {
			await Promise.all(runners.map((runner) => runner.close()));
			await sql`DROP SCHEMA ${sql.id(schema)} CASCADE`.execute(database);
			await database.destroy();
			await rm(directory, { recursive: true, force: true });
		},
	};
};

const settled = async (database: Kysely<Database>, id: string) => {
	const deadline = Date.now() + 10000;
	while (Date.now() < deadline) {
		const detail = await readPublicationJob(database, id);
		if (detail !== undefined && detail.job.outcome !== "running") return detail;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error("Publication did not finish");
};

test.skipIf(!databaseUrl)(
	"runner publishes generated changes/deletions, captures a consistent revision, and handles no-change",
	async () => {
		const f = await fixture({ newBranch: true });
		try {
			let edited = false;
			const source = f.database.withPlugin({
				transformQuery: ({ node }) => node,
				transformResult: async ({ result }) => {
					if (
						!edited &&
						result.rows.some(
							(row) =>
								Object.keys(row).length === 1 &&
								typeof row.revision === "string",
						)
					) {
						edited = true;
						await f.database
							.updateTable("tags")
							.set({ title: "Concurrent Tag" })
							.execute();
					}
					return result;
				},
			});
			const runner = await f.create(source);
			const first = await runner.start({ requestedBy: "admin" });
			const done = await settled(f.database, first.id);
			expect(done.job.outcome).toBe("succeeded");
			expect(done.job.revision).toBe("1");
			expect(done.job.commitId).toBeDefined();
			expect(
				(
					await f.database
						.selectFrom("archive_publication_state")
						.selectAll()
						.execute()
				)[0],
			).toMatchObject({ revision: "2", published_revision: "1" });
			expect(
				await f.git(
					"--git-dir",
					f.remote,
					"rev-parse",
					"refs/heads/publish-dev",
				),
			).toBe(done.job.commitId);
			expect(
				await readFile(path.join(f.checkout, "src/res/mixcloud.json"), "utf8"),
			).toBe("unrelated resource\n");
			expect(
				await readFile(path.join(f.checkout, "public/assets/logo.svg"), "utf8"),
			).toBe("unrelated asset\n");
			expect(
				await Bun.file(path.join(f.checkout, "src/res/djs/99.json")).exists(),
			).toBe(false);
			expect(
				await Bun.file(
					path.join(f.checkout, "public/assets/djs/99_small.webp"),
				).exists(),
			).toBe(false);
			expect(
				JSON.parse(
					await readFile(path.join(f.checkout, "src/res/tags.json"), "utf8"),
				)[0].title,
			).toBe("Original Tag");
			expect(await f.git("show", "-s", "--format=%B", "HEAD")).toContain(
				`Archive-Publication-Job: ${first.id}`,
			);
			const second = await runner.start({ requestedBy: "admin" });
			expect((await settled(f.database, second.id)).job.outcome).toBe(
				"succeeded",
			);
			const head = await f.git("rev-parse", "HEAD");
			const third = await runner.start({ requestedBy: "admin" });
			expect((await settled(f.database, third.id)).job.outcome).toBe(
				"no-change",
			);
			expect(await f.git("rev-parse", "HEAD")).toBe(head);
			expect(
				(
					await f.database
						.selectFrom("archive_publication_state")
						.select("published_revision")
						.executeTakeFirstOrThrow()
				).published_revision,
			).toBe("2");
			await runner.close();
			await expect(runner.start({ requestedBy: "admin" })).rejects.toThrow(
				"closing",
			);
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"failed pushes keep commit identity; explicit retry reconciles before acknowledging only its original revision",
	async () => {
		const f = await fixture();
		try {
			const hook = path.join(f.remote, "hooks/pre-receive");
			await writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
			let runner = await f.create();
			const first = await runner.start({ requestedBy: "admin" });
			const failed = await settled(f.database, first.id);
			expect(failed.job.outcome).toBe("failed");
			expect(failed.job.commitId).toBe(await f.git("rev-parse", "HEAD"));
			expect(
				(
					await f.database
						.selectFrom("archive_publication_state")
						.select("published_revision")
						.executeTakeFirstOrThrow()
				).published_revision,
			).toBe("0");
			await expect(runner.start({ requestedBy: "admin" })).rejects.toThrow(
				"Retry",
			);
			await runner.close();
			await f.database
				.updateTable("tags")
				.set({ title: "Newer edit" })
				.execute();
			await rm(hook);
			runner = await f.create();
			const retry = await runner.start({
				requestedBy: "admin",
				retryJobId: first.id,
			});
			const recovered = await settled(f.database, retry.id);
			expect(recovered.job.outcome).toBe("succeeded");
			expect(recovered.job.commitId).toBe(failed.job.commitId);
			expect(recovered.job.revision).toBe("1");
			expect(
				await f.database
					.selectFrom("archive_publication_state")
					.selectAll()
					.executeTakeFirstOrThrow(),
			).toMatchObject({ revision: "2", published_revision: "1" });
			// Simulate a crash after successful push but before storing the job result.
			await runner.close();
			await f.database
				.updateTable("archive_publication_jobs")
				.set({ outcome: "running", completed_at: null, error: null })
				.where("id", "=", retry.id)
				.execute();
			runner = await f.create();
			expect(
				(await readPublicationJob(f.database, retry.id))?.job.outcome,
			).toBe("interrupted");
			const again = await runner.start({
				requestedBy: "admin",
				retryJobId: retry.id,
			});
			expect((await settled(f.database, again.id)).job).toMatchObject({
				outcome: "succeeded",
				commitId: failed.job.commitId,
				revision: "1",
			});
			expect(await f.git("rev-parse", "HEAD")).toBe(failed.job.commitId);
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"completion cannot acknowledge a different revision and failure never clears pending state",
	async () => {
		const f = await fixture();
		try {
			const { lease, job } = await reservePublicationJob({
				database: f.database,
				config: f.config,
				request: { requestedBy: "admin" },
			});
			try {
				await capturePublicationRevision(lease, job.id, "1");
				await expect(
					completePublicationJob(lease, job.id, {
						outcome: "no-change",
						acknowledgedRevision: "2",
					}),
				).rejects.toThrow("captured");
				await expect(
					completePublicationJob(lease, job.id, {
						outcome: "failed",
						acknowledgedRevision: "1",
					}),
				).rejects.toThrow("acknowledgement");
				expect(
					(
						await f.database
							.selectFrom("archive_publication_state")
							.select("published_revision")
							.executeTakeFirstOrThrow()
					).published_revision,
				).toBe("0");
				await completePublicationJob(lease, job.id, {
					outcome: "failed",
					error: "Safe failure",
				});
			} finally {
				await lease.release();
			}
			const available = await acquirePublicationLease(f.database);
			expect(available).toBeDefined();
			await available?.release();
		} finally {
			await f.close();
		}
	},
);
