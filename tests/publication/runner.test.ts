import { expect, spyOn, test } from "bun:test";
import { execFile } from "node:child_process";
import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as revisions } from "../../src/db/migrations/0029_add_archive_publication_state.js";
import { up as jobs } from "../../src/db/migrations/0030_add_archive_publication_jobs.js";
import { up as logs } from "../../src/db/migrations/0031_add_archive_publication_logs.js";
import { up as notifications } from "../../src/db/migrations/0032_notify_publication_jobs.js";
import { up as publicationModes } from "../../src/db/migrations/0033_add_publication_modes.js";
import type { Database } from "../../src/db/types.js";
import {
	acquirePublicationLease,
	capturePublicationRevision,
	completePublicationJob,
	createPublicationRunner,
	type PublicationConfig,
	type PublicationRunner,
	type PublicationStart,
	readPublicationJob,
	readPublicationStatus,
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
	await writeFile(
		path.join(checkout, "src/res/djs/99.json"),
		JSON.stringify({
			id: 99,
			title: "Removed DJ",
			bio: "Removed",
			tagIds: [],
			shows: [],
		}),
	);
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
	for (const migration of [
		revisions,
		jobs,
		logs,
		notifications,
		publicationModes,
	])
		await database.transaction().execute(migration);
	const config: PublicationConfig = {
		mode: "remote",
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
		create: async (
			source = database,
			publicationConfig: PublicationConfig = config,
		) => {
			const runner = await createPublicationRunner(source, publicationConfig);
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

const readyPreview = async (
	runner: PublicationRunner,
	request: PublicationStart = { requestedBy: "admin" },
) => {
	return runner.preparePreview(request);
};
const publishReviewed = async (
	runner: PublicationRunner,
	request: PublicationStart = { requestedBy: "admin" },
) => {
	const preview = await readyPreview(runner, request);
	return runner.start({ ...request, previewId: preview.id });
};

test.skipIf(!databaseUrl)(
	"local publication exports on the current branch without fetch, push, or index changes; mode and branch switches stay pending",
	async () => {
		const f = await fixture();
		const originalPath = process.env.PATH;
		try {
			await f.git("switch", "-c", "feature/local-export");
			// An unreachable origin proves export needs no remote connectivity.
			await f.git(
				"remote",
				"set-url",
				"origin",
				"/unavailable/publication-remote",
			);
			await writeFile(path.join(f.checkout, "notes.txt"), "staged work");
			await f.git("add", "notes.txt");
			await writeFile(path.join(f.checkout, "notes.txt"), "unstaged work");
			const head = await f.git("rev-parse", "HEAD");
			const index = await readFile(path.join(f.checkout, ".git/index"));
			const bin = path.join(f.directory, "bin");
			await mkdir(bin);
			const realGit = Bun.which("git");
			if (!realGit) throw new Error("Git is required for this test");
			const commandLog = path.join(f.directory, "git-commands.jsonl");
			await writeFile(
				path.join(bin, "git"),
				`#!${process.execPath}
import {appendFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const args = process.argv.slice(2);
appendFileSync(${JSON.stringify(commandLog)}, JSON.stringify(args) + '\\n');
const result = spawnSync(${JSON.stringify(realGit)}, args, {stdio: 'inherit'});
process.exit(result.status ?? 1);
`,
			);
			await chmod(path.join(bin, "git"), 0o755);
			process.env.PATH = `${bin}:${originalPath}`;
			const local: PublicationConfig = {
				mode: "local",
				checkoutPath: f.checkout,
			};
			const runner = await f.create(f.database, local);
			const start = await publishReviewed(runner);
			const done = await settled(f.database, start.id);
			expect(done.job.outcome).toBe("succeeded");
			expect(done.job.commitId).toBeUndefined();
			expect(done.job.target).toEqual({
				...local,
				branch: "feature/local-export",
				repository: "/unavailable/publication-remote",
			});
			expect((await readPublicationStatus(f.database, local)).pending).toBe(
				false,
			);
			const commands: string[][] = (await readFile(commandLog, "utf8"))
				.trim()
				.split("\n")
				.map((line) => JSON.parse(line));
			expect(commands.length).toBeGreaterThan(0);
			for (const args of commands) {
				// Every invocation must be one of the three local metadata reads.
				expect(
					args.includes("rev-parse") ||
						args.includes("symbolic-ref") ||
						(args.includes("remote") && args.includes("get-url")),
				).toBe(true);
			}
			process.env.PATH = originalPath;
			expect(await f.git("rev-parse", "HEAD")).toBe(head);
			expect(await readFile(path.join(f.checkout, ".git/index"))).toEqual(
				index,
			);
			expect(await readFile(path.join(f.checkout, "notes.txt"), "utf8")).toBe(
				"unstaged work",
			);
			expect(
				await Bun.file(path.join(f.checkout, "src/res/djs/99.json")).exists(),
			).toBe(false);
			expect(
				await Bun.file(
					path.join(f.checkout, "public/assets/djs/1_small.webp"),
				).exists(),
			).toBe(true);
			expect(
				JSON.parse(
					await readFile(path.join(f.checkout, "src/res/tags.json"), "utf8"),
				)[0].title,
			).toBe("Original Tag");
			expect((await readPublicationStatus(f.database, f.config)).pending).toBe(
				true,
			);
			await f.git("switch", "-c", "feature/another");
			expect((await readPublicationStatus(f.database, local)).pending).toBe(
				true,
			);
		} finally {
			if (originalPath === undefined) delete process.env.PATH;
			else process.env.PATH = originalPath;
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"local preview rejects unsafe destinations without creating a job and supports repaired non-Git directories",
	async () => {
		const f = await fixture();
		try {
			await rm(path.join(f.checkout, ".git"), { recursive: true });
			const local: PublicationConfig = {
				mode: "local",
				checkoutPath: f.checkout,
			};
			const outside = path.join(f.directory, "outside.json");
			await writeFile(outside, "keep me");
			await symlink(outside, path.join(f.checkout, "src/res/shows.json"));
			const runner = await f.create(f.database, local);
			await expect(readyPreview(runner)).rejects.toThrow();
			expect(
				(await readPublicationStatus(f.database, local)).latestJob,
			).toBeUndefined();
			expect((await readPublicationStatus(f.database, local)).pending).toBe(
				true,
			);
			expect(await readFile(outside, "utf8")).toBe("keep me");
			await rm(path.join(f.checkout, "src/res/shows.json"));
			const preview = await readyPreview(runner);
			expect(preview.changes.djs.removed).toEqual(["Removed DJ"]);
			expect(
				await Bun.file(path.join(f.checkout, "src/res/djs/99.json")).exists(),
			).toBe(true);
			const job = await runner.start({
				requestedBy: "admin",
				previewId: preview.id,
			});
			expect((await settled(f.database, job.id)).job.outcome).toBe("succeeded");
			expect((await readPublicationStatus(f.database, local)).pending).toBe(
				false,
			);
			expect(job.target).toEqual(local);
		} finally {
			await f.close();
		}
	},
	20000,
);

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
							(row) => row.outcome === "running" && row.stage === "queued",
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
			const first = await publishReviewed(runner);
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
			const second = await publishReviewed(runner);
			expect((await settled(f.database, second.id)).job.outcome).toBe(
				"succeeded",
			);
			const head = await f.git("rev-parse", "HEAD");
			const third = await publishReviewed(runner);
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
			const first = await publishReviewed(runner);
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
			// Work locally between remote failure and retry. Returning to remote
			// must still find its own failed job, not lose it behind local history.
			const localConfig: PublicationConfig = {
				mode: "local",
				checkoutPath: f.checkout,
			};
			const localRunner = await f.create(f.database, localConfig);
			const localJob = await publishReviewed(localRunner);
			expect((await settled(f.database, localJob.id)).job.outcome).toBe(
				"succeeded",
			);
			expect(
				(await readPublicationStatus(f.database, f.config)).latestJob?.id,
			).toBe(first.id);
			await localRunner.close();
			await rm(hook);
			runner = await f.create();
			const retry = await publishReviewed(runner, {
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
			const again = await publishReviewed(runner, {
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

test.skipIf(!databaseUrl)(
	"preview exposes readable changes only to its owner and leaves checkout and index untouched",
	async () => {
		const f = await fixture();
		try {
			const runner = await f.create();
			const head = await f.git("rev-parse", "HEAD");
			const status = await f.git("status", "--porcelain=v1");
			const index = await readFile(path.join(f.checkout, ".git/index"));
			const original = await readFile(
				path.join(f.checkout, "src/res/djs/99.json"),
			);
			const preview = await readyPreview(runner);
			expect(preview.changes.djs.removed).toEqual(["Removed DJ"]);
			expect(preview.changes.djs.added).toEqual(["Runner DJ"]);
			await expect(
				runner.start({ requestedBy: "another-admin", previewId: preview.id }),
			).rejects.toThrow("fresh preview");
			expect(await f.git("rev-parse", "HEAD")).toBe(head);
			expect(await f.git("status", "--porcelain=v1")).toBe(status);
			expect(await readFile(path.join(f.checkout, ".git/index"))).toEqual(
				index,
			);
			expect(
				await readFile(path.join(f.checkout, "src/res/djs/99.json")),
			).toEqual(original);
			expect(
				(await readPublicationStatus(f.database, f.config)).latestJob,
			).toBeUndefined();
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"missing, foreign and expired previews cannot create publication jobs",
	async () => {
		const f = await fixture();
		try {
			const runner = await f.create();
			await expect(runner.start({ requestedBy: "admin" })).rejects.toThrow(
				"fresh preview",
			);
			await expect(
				runner.start({ requestedBy: "admin", previewId: crypto.randomUUID() }),
			).rejects.toThrow("fresh preview");
			const preview = await readyPreview(runner);
			await expect(
				runner.start({ requestedBy: "another-admin", previewId: preview.id }),
			).rejects.toThrow("fresh preview");
			const clock = spyOn(Date, "now").mockReturnValue(
				Date.parse(preview.expiresAt) + 1,
			);
			try {
				await expect(
					runner.start({ requestedBy: "admin", previewId: preview.id }),
				).rejects.toThrow("fresh preview");
			} finally {
				clock.mockRestore();
			}
			expect(
				(await readPublicationStatus(f.database, f.config)).latestJob,
			).toBeUndefined();
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"database edits and remote branch movement invalidate a reviewed preview before job creation",
	async () => {
		const f = await fixture();
		try {
			const runner = await f.create();
			const preview = await readyPreview(runner);
			await f.database
				.updateTable("tags")
				.set({ title: "Edited after review" })
				.execute();
			await expect(
				runner.start({ requestedBy: "admin", previewId: preview.id }),
			).rejects.toThrow("Archive data changed");
			expect(
				(await readPublicationStatus(f.database, f.config)).latestJob,
			).toBeUndefined();
			const refreshed = await readyPreview(runner);
			await f.git("commit", "--allow-empty", "-m", "External branch update");
			await f.git("push", "origin", "publish-dev");
			await expect(
				runner.start({ requestedBy: "admin", previewId: refreshed.id }),
			).rejects.toThrow("Target branch changed");
			expect(
				(await readPublicationStatus(f.database, f.config)).latestJob,
			).toBeUndefined();
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"invalid baseline data produces a failed preview without touching the checkout or creating a job",
	async () => {
		const f = await fixture();
		try {
			await writeFile(path.join(f.checkout, "src/res/tags.json"), "{ invalid");
			await f.git("add", "src/res/tags.json");
			await f.git("commit", "-m", "Malformed archive baseline");
			await f.git("push", "origin", "publish-dev");
			const runner = await f.create();
			await expect(
				runner.preparePreview({ requestedBy: "admin" }),
			).rejects.toThrow();
			expect(
				(await readPublicationStatus(f.database, f.config)).latestJob,
			).toBeUndefined();
			expect(
				await readFile(path.join(f.checkout, "src/res/tags.json"), "utf8"),
			).toBe("{ invalid");
			expect(await f.git("status", "--porcelain=v1")).toBe("");
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"shutdown rejects further previews and publication without changing the checkout",
	async () => {
		const f = await fixture();
		try {
			const runner = await f.create();
			const preview = await readyPreview(runner);
			const head = await f.git("rev-parse", "HEAD");
			const index = await readFile(path.join(f.checkout, ".git/index"));
			await runner.close();
			await expect(
				runner.preparePreview({ requestedBy: "admin" }),
			).rejects.toThrow("closing");
			await expect(
				runner.start({ requestedBy: "admin", previewId: preview.id }),
			).rejects.toThrow("closing");
			expect(
				(await readPublicationStatus(f.database, f.config)).latestJob,
			).toBeUndefined();
			expect(await f.git("rev-parse", "HEAD")).toBe(head);
			expect(await readFile(path.join(f.checkout, ".git/index"))).toEqual(
				index,
			);
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"local previews reject changed database and changed destination content before creating jobs",
	async () => {
		const f = await fixture();
		try {
			const local: PublicationConfig = {
				mode: "local",
				checkoutPath: f.checkout,
			};
			const runner = await f.create(f.database, local);
			const first = await readyPreview(runner);
			await f.database
				.updateTable("tags")
				.set({ title: "New database title" })
				.execute();
			await expect(
				runner.start({ requestedBy: "admin", previewId: first.id }),
			).rejects.toThrow("Archive data changed");
			expect(
				(await readPublicationStatus(f.database, local)).latestJob,
			).toBeUndefined();
			const second = await readyPreview(runner);
			await writeFile(path.join(f.checkout, "src/res/tags.json"), "[]\n");
			await expect(
				runner.start({ requestedBy: "admin", previewId: second.id }),
			).rejects.toThrow("changed");
			expect(
				(await readPublicationStatus(f.database, local)).latestJob,
			).toBeUndefined();
			const third = await readyPreview(runner);
			// Unrelated edits do not change the generated archive baseline.
			await writeFile(
				path.join(f.checkout, "notes.txt"),
				"unrelated local work",
			);
			const job = await runner.start({
				requestedBy: "admin",
				previewId: third.id,
			});
			expect((await settled(f.database, job.id)).job.outcome).toBe("succeeded");
			expect(await readFile(path.join(f.checkout, "notes.txt"), "utf8")).toBe(
				"unrelated local work",
			);
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"local publication installs the reviewed snapshot while edits committed after confirmation stay pending",
	async () => {
		const f = await fixture();
		try {
			let edited = false;
			const source = f.database.withPlugin({
				transformQuery: ({ node }) => node,
				transformResult: async ({ result }) => {
					if (
						!edited &&
						result.rows.some(
							(row) => row.outcome === "running" && row.stage === "queued",
						)
					) {
						edited = true;
						await f.database
							.updateTable("tags")
							.set({ title: "Concurrent local edit" })
							.execute();
					}
					return result;
				},
			});
			const local: PublicationConfig = {
				mode: "local",
				checkoutPath: f.checkout,
			};
			const runner = await f.create(source, local);
			const preview = await readyPreview(runner);
			expect(preview.revision).toBe("1");
			const job = await runner.start({
				requestedBy: "admin",
				previewId: preview.id,
			});
			expect((await settled(f.database, job.id)).job).toMatchObject({
				outcome: "succeeded",
				revision: "1",
			});
			expect(
				JSON.parse(
					await readFile(path.join(f.checkout, "src/res/tags.json"), "utf8"),
				)[0].title,
			).toBe("Original Tag");
			expect((await readPublicationStatus(f.database, local)).pending).toBe(
				true,
			);
			expect(
				await f.database
					.selectFrom("archive_publication_state")
					.selectAll()
					.executeTakeFirstOrThrow(),
			).toMatchObject({ revision: "2", published_revision: "1" });
		} finally {
			await f.close();
		}
	},
	20000,
);

test.skipIf(!databaseUrl)(
	"local failed publication retries with a fresh reviewed snapshot",
	async () => {
		const f = await fixture();
		try {
			let changed = false;
			const outside = path.join(f.directory, "outside.json");
			await writeFile(outside, "preserve outside");
			const source = f.database.withPlugin({
				transformQuery: ({ node }) => node,
				transformResult: async ({ result }) => {
					if (
						!changed &&
						result.rows.some(
							(row) => row.outcome === "running" && row.stage === "queued",
						)
					) {
						changed = true;
						await symlink(outside, path.join(f.checkout, "src/res/shows.json"));
					}
					return result;
				},
			});
			const local: PublicationConfig = {
				mode: "local",
				checkoutPath: f.checkout,
			};
			const runner = await f.create(source, local);
			const first = await publishReviewed(runner);
			expect((await settled(f.database, first.id)).job.outcome).toBe("failed");
			expect(await readFile(outside, "utf8")).toBe("preserve outside");
			expect((await readPublicationStatus(f.database, local)).pending).toBe(
				true,
			);
			await rm(path.join(f.checkout, "src/res/shows.json"));
			await f.database
				.updateTable("tags")
				.set({ title: "Fresh retry title" })
				.execute();
			const remote = await f.create();
			await expect(
				remote.start({ requestedBy: "admin", retryJobId: first.id }),
			).rejects.toThrow("Retry target differs");
			const retry = await publishReviewed(runner, {
				requestedBy: "admin",
				retryJobId: first.id,
			});
			expect((await settled(f.database, retry.id)).job).toMatchObject({
				outcome: "succeeded",
				revision: "2",
			});
			expect(
				JSON.parse(
					await readFile(path.join(f.checkout, "src/res/tags.json"), "utf8"),
				)[0].title,
			).toBe("Fresh retry title");
			expect((await readPublicationStatus(f.database, local)).pending).toBe(
				false,
			);
		} finally {
			await f.close();
		}
	},
	20000,
);
