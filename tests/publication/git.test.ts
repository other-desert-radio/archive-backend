import { afterEach, expect, test } from "bun:test";
import { execFile } from "node:child_process";
import {
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
import {
	type PublicationGitContext,
	validatePublicationCheckout,
} from "../../src/publication/index.js";

const execute = promisify(execFile);
const directories: string[] = [];

afterEach(async () => {
	await Promise.all(
		directories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

const fixture = async ({ commit = true }: { commit?: boolean } = {}) => {
	const directory = await mkdtemp(path.join(tmpdir(), "publication-git-"));
	directories.push(directory);
	const checkout = path.join(directory, "checkout");
	await mkdir(checkout);
	const git = async (...args: string[]) => {
		const { stdout } = await execute("git", ["-C", checkout, ...args], {
			env: {
				...Object.fromEntries(
					Object.entries(process.env).filter(
						([key]) => !key.startsWith("GIT_"),
					),
				),
				GIT_CONFIG_NOSYSTEM: "1",
				GIT_CONFIG_GLOBAL: "/dev/null",
			},
		});
		return stdout.trim();
	};
	await git("init", "--initial-branch=publish-dev");
	await git("config", "core.hooksPath", "/dev/null");
	await git("config", "user.name", "Publication Test");
	await git("config", "user.email", "publication@example.test");
	await git(
		"remote",
		"add",
		"origin",
		"git@github.com:other-desert-radio/archive-site.git",
	);
	if (commit) {
		await writeFile(path.join(checkout, "README.md"), "original\n");
		await git("add", "README.md");
		await git("commit", "-m", "Initial fixture");
	}
	const config = {
		enabled: true,
		repository: "git@github.com:other-desert-radio/archive-site.git",
		checkoutPath: checkout,
		branch: "publish-dev",
	};
	const logs: string[] = [];
	const context: PublicationGitContext = {
		config,
		job: {
			id: crypto.randomUUID(),
			requestedBy: "admin",
			createdAt: new Date().toISOString(),
			target: {
				repository: config.repository,
				checkoutPath: checkout,
				branch: config.branch,
			},
			outcome: "running",
			stage: "validating",
		},
		log: async (message) => {
			logs.push(message);
		},
	};
	return { directory, checkout, git, context, logs };
};

test("checkout validation is local and preserves staged, unstaged, and untracked work", async () => {
	const { checkout, git, context, logs } = await fixture();
	await writeFile(path.join(checkout, "README.md"), "staged\n");
	await git("add", "README.md");
	await writeFile(path.join(checkout, "README.md"), "unstaged\n");
	await writeFile(path.join(checkout, "untracked.txt"), "keep\n");
	const before = {
		head: await git("rev-parse", "HEAD"),
		status: await git("status", "--porcelain"),
		index: await readFile(path.join(checkout, ".git/index")),
	};
	await validatePublicationCheckout(context);
	await validatePublicationCheckout(context);
	expect(await readFile(path.join(checkout, ".git/index"))).toEqual(
		before.index,
	);
	const after = {
		head: await git("rev-parse", "HEAD"),
		status: await git("status", "--porcelain"),
		index: await readFile(path.join(checkout, ".git/index")),
	};
	expect(after.head).toBe(before.head);
	expect(after.status).toBe(before.status);
	expect(await readFile(path.join(checkout, "README.md"), "utf8")).toBe(
		"unstaged\n",
	);
	expect(await readFile(path.join(checkout, "untracked.txt"), "utf8")).toBe(
		"keep\n",
	);
	expect(logs).toEqual(
		Array(2).fill(
			"Validated publication checkout, branch, origin, and output paths",
		),
	);
});

test("inherited Git redirection and global URL rewrites cannot change checkout inspection", async () => {
	const { directory, context } = await fixture();
	const globalConfig = path.join(directory, "global-config");
	await writeFile(
		globalConfig,
		'[url "https://example.test/unexpected/"]\n\tinsteadOf = git@github.com:\n',
	);
	const injected = {
		GIT_DIR: path.join(directory, "missing-git-dir"),
		GIT_WORK_TREE: directory,
		GIT_CONFIG_GLOBAL: globalConfig,
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: "remote.origin.url",
		GIT_CONFIG_VALUE_0: "https://example.test/override",
	};
	const previous = Object.fromEntries(
		Object.keys(injected).map((name) => [name, process.env[name]]),
	);
	try {
		Object.assign(process.env, injected);
		await validatePublicationCheckout(context);
	} finally {
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
	}
	expect(context.config.repository).toBe(
		"git@github.com:other-desert-radio/archive-site.git",
	);
});

test("checkout validation rejects missing paths, non-repositories, and backend aliases", async () => {
	const { checkout, directory, context } = await fixture();
	for (const target of [path.join(directory, "missing"), directory]) {
		await expect(
			validatePublicationCheckout({
				...context,
				config: { ...context.config, checkoutPath: target },
				job: {
					...context.job,
					target: { ...context.job.target, checkoutPath: target },
				},
			}),
		).rejects.toThrow();
	}
	const alias = path.join(directory, "backend-alias");
	await symlink(path.resolve(import.meta.dir, "../.."), alias);
	await expect(
		validatePublicationCheckout({
			...context,
			config: { ...context.config, checkoutPath: alias },
			job: {
				...context.job,
				target: { ...context.job.target, checkoutPath: alias },
			},
		}),
	).rejects.toThrow("separate from the backend");
	await mkdir(path.join(checkout, "nested"));
	const nested = path.join(checkout, "nested");
	await expect(
		validatePublicationCheckout({
			...context,
			config: { ...context.config, checkoutPath: nested },
			job: {
				...context.job,
				target: { ...context.job.target, checkoutPath: nested },
			},
		}),
	).rejects.toThrow("dedicated checkout");
});

test("checkout validation rejects changed targets, wrong branches, detached and unborn HEAD", async () => {
	const { git, context } = await fixture();
	await expect(
		validatePublicationCheckout({
			...context,
			config: { ...context.config, branch: "main" },
		}),
	).rejects.toThrow("saved job target");
	await git("switch", "-c", "other");
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"wrong branch",
	);
	await git("checkout", "--detach");
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"inspect publication checkout",
	);
	await expect(
		validatePublicationCheckout((await fixture({ commit: false })).context),
	).rejects.toThrow("inspect publication checkout");
});

test("origin fetch, push, multiple URLs, and local URL rewrites must match the expected repository", async () => {
	const { git, context } = await fixture();
	await git(
		"remote",
		"set-url",
		"--push",
		"origin",
		"https://example.test/other.git",
	);
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"fetch and push URLs",
	);
	await git("config", "--unset-all", "remote.origin.pushurl");
	await git(
		"remote",
		"set-url",
		"--add",
		"origin",
		"https://example.test/other.git",
	);
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"fetch and push URLs",
	);
	await git("config", "--unset-all", "remote.origin.url");
	await git("config", "remote.origin.url", "alias:archive.git");
	await git("config", "url.https://example.test/.insteadOf", "alias:");
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"fetch and push URLs",
	);
});

test("in-progress Git operations reject validation without removing their markers", async () => {
	const { checkout, context } = await fixture();
	for (const marker of [
		"MERGE_HEAD",
		"CHERRY_PICK_HEAD",
		"REVERT_HEAD",
		"BISECT_LOG",
		"rebase-apply",
		"rebase-merge",
		"sequencer",
	]) {
		const file = path.join(checkout, ".git", marker);
		await writeFile(file, "pending-operation");
		await expect(validatePublicationCheckout(context)).rejects.toThrow(
			"in-progress Git operation",
		);
		expect(await readFile(file, "utf8")).toBe("pending-operation");
		await rm(file);
	}
});

test("output symlinks and non-directory ancestors are rejected without touching their targets", async () => {
	const { checkout, directory, context } = await fixture();
	const outside = path.join(directory, "outside");
	await mkdir(outside);
	await writeFile(path.join(outside, "keep.txt"), "preserved");
	await symlink(outside, path.join(checkout, "src"));
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"without symlinks",
	);
	await rm(path.join(checkout, "src"));
	await mkdir(path.join(checkout, "src/res"), { recursive: true });
	await symlink(
		path.join(outside, "keep.txt"),
		path.join(checkout, "src/res/shows.json"),
	);
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"JSON destinations",
	);
	expect(await readFile(path.join(outside, "keep.txt"), "utf8")).toBe(
		"preserved",
	);
	await rm(path.join(checkout, "src/res/shows.json"));
	await writeFile(path.join(checkout, "public"), "not a directory");
	await expect(validatePublicationCheckout(context)).rejects.toThrow(
		"real directories",
	);
});

test("linked worktrees are rejected because they share repository administration", async () => {
	const { directory, git, context } = await fixture();
	const worktree = path.join(directory, "linked");
	await git("worktree", "add", "-b", "linked", worktree);
	await expect(
		validatePublicationCheckout({
			...context,
			config: { ...context.config, checkoutPath: worktree, branch: "linked" },
			job: {
				...context.job,
				target: {
					...context.job.target,
					checkoutPath: worktree,
					branch: "linked",
				},
			},
		}),
	).rejects.toThrow("own .git directory");
});
