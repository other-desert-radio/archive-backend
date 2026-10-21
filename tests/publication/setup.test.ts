import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const directories: string[] = [];
const repository = "git@github.com:other-desert-radio/archive-site.git";
const script = path.resolve(
	import.meta.dir,
	"../../scripts/setup-archive-publication",
);
afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});
const fixture = async () => {
	const checkout = await mkdtemp(path.join(tmpdir(), "publication-setup-"));
	directories.push(checkout);
	const git = (...args: string[]) =>
		execFileSync("git", ["-C", checkout, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	git("init", "--initial-branch=publish-dev");
	git("config", "user.name", "Setup Test");
	git("config", "user.email", "setup@example.test");
	git("remote", "add", "origin", repository);
	await writeFile(path.join(checkout, "README.md"), "original\n");
	git("add", "README.md");
	git("commit", "-m", "initial");
	const setup = () =>
		Bun.spawn([process.execPath, script], {
			cwd: tmpdir(),
			env: {
				...process.env,
				ARCHIVE_SITE_REPOSITORY: repository,
				ARCHIVE_CHECKOUT_PATH: checkout,
				ARCHIVE_PUBLISH_BRANCH: "publish-dev",
				ARCHIVE_PUBLISH_MODE: "remote",
				ARCHIVE_GIT_NAME: "Archive Publisher",
				ARCHIVE_GIT_EMAIL: "publisher@example.test",
			},
			stdout: "pipe",
			stderr: "pipe",
		});
	return { checkout, git, setup };
};

test("setup configures local identity while preserving staged and untracked work", async () => {
	const { checkout, git, setup } = await fixture();
	await writeFile(path.join(checkout, "README.md"), "pending\n");
	git("add", "README.md");
	await writeFile(path.join(checkout, "untracked"), "keep\n");
	const before = git("status", "--porcelain");
	const head = git("rev-parse", "HEAD");
	const result = setup();
	const error = await new Response(result.stderr).text();
	expect(await result.exited, error).toBe(0);
	expect(git("config", "--local", "user.name")).toBe("Archive Publisher");
	expect(git("config", "--local", "user.email")).toBe("publisher@example.test");
	expect(git("status", "--porcelain")).toBe(before);
	expect(git("rev-parse", "HEAD")).toBe(head);
	expect(await readFile(path.join(checkout, "untracked"), "utf8")).toBe(
		"keep\n",
	);
});

test("setup refuses to switch branches with pending work", async () => {
	const { checkout, git, setup } = await fixture();
	git("switch", "-c", "manual-work");
	await writeFile(path.join(checkout, "README.md"), "pending\n");
	const result = setup();
	expect(await result.exited).toBe(1);
	const error = await new Response(result.stderr).text();
	expect(error).toContain('checkout is on branch "manual-work"');
	expect(error).toContain('publication is configured for branch "publish-dev"');
	expect(git("branch", "--show-current")).toBe("manual-work");
	expect(await readFile(path.join(checkout, "README.md"), "utf8")).toBe(
		"pending\n",
	);
});

test("setup selects an existing target branch without changing commits", async () => {
	const { git, setup } = await fixture();
	git("switch", "-c", "manual-work");
	const head = git("rev-parse", "HEAD");
	const result = setup();
	expect(await result.exited).toBe(0);
	expect(git("branch", "--show-current")).toBe("publish-dev");
	expect(git("rev-parse", "HEAD")).toBe(head);
});

test("setup rejects a mismatched origin without altering it", async () => {
	const { git, setup } = await fixture();
	git("remote", "set-url", "origin", "git@github.com:example/wrong.git");
	const result = setup();
	expect(await result.exited).toBe(1);
	expect(await new Response(result.stderr).text()).toContain(
		"origin must match",
	);
	expect(git("remote", "get-url", "origin")).toBe(
		"git@github.com:example/wrong.git",
	);
});

test("fresh setup creates publish-dev from remote main without pushing", async () => {
	const { checkout, git } = await fixture();
	git("branch", "-m", "main");
	const remote = path.join(
		checkout,
		"..",
		`${path.basename(checkout)}-remote.git`,
	);
	const fresh = path.join(checkout, "..", `${path.basename(checkout)}-fresh`);
	const shim = path.join(
		checkout,
		"..",
		`${path.basename(checkout)}-transport`,
	);
	directories.push(remote, fresh, shim);
	git("clone", "--bare", checkout, remote);
	await mkdir(shim);
	const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
	// Replace network transport only; clone/fetch/branch/switch use real local Git.
	await writeFile(
		path.join(shim, "git"),
		`#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
const args = process.argv.slice(2);
const original = [...args];
if (args.includes("clone")) args[args.indexOf(process.env.ARCHIVE_SITE_REPOSITORY)] = process.env.SETUP_LOCAL_REMOTE;
if (args.includes("fetch")) args[args.indexOf("origin")] = process.env.SETUP_LOCAL_REMOTE;
execFileSync(process.env.SETUP_REAL_GIT, args, { stdio: "inherit" });
if (original.includes("clone")) execFileSync(process.env.SETUP_REAL_GIT, ["-C", original.at(-1), "remote", "set-url", "origin", process.env.ARCHIVE_SITE_REPOSITORY]);
`,
	);
	await chmod(path.join(shim, "git"), 0o755);
	const result = Bun.spawn([process.execPath, script], {
		cwd: tmpdir(),
		env: {
			...process.env,
			PATH: `${shim}:${process.env.PATH}`,
			SETUP_REAL_GIT: realGit,
			SETUP_LOCAL_REMOTE: remote,
			ARCHIVE_SITE_REPOSITORY: repository,
			ARCHIVE_CHECKOUT_PATH: fresh,
			ARCHIVE_PUBLISH_BRANCH: "publish-dev",
			ARCHIVE_PUBLISH_MODE: "remote",
			ARCHIVE_GIT_NAME: "Archive Publisher",
			ARCHIVE_GIT_EMAIL: "publisher@example.test",
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const error = await new Response(result.stderr).text();
	expect(await result.exited, error).toBe(0);
	const output = (...args: string[]) =>
		execFileSync(realGit, ["-C", fresh, ...args], { encoding: "utf8" }).trim();
	expect(output("branch", "--show-current")).toBe("publish-dev");
	expect(output("rev-parse", "HEAD")).toBe(git("rev-parse", "main"));
	expect(output("remote", "get-url", "origin")).toBe(repository);
	expect(
		execFileSync(
			realGit,
			["--git-dir", remote, "branch", "--format=%(refname:short)"],
			{ encoding: "utf8" },
		).trim(),
	).toBe("main");
});
