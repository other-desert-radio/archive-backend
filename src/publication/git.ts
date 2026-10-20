import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isMatching, P } from "ts-pattern";
import { readArchiveCheckoutPath } from "./config.js";
import type { PublicationConfig, PublicationJob } from "./types.js";

const executeFile = promisify(execFile);

/** Use argv, fixed safeguards, and sanitized errors for local and network commands. */
const runGit = async ({
	checkout,
	args,
	operation = "inspect",
	timeout = 10000,
}: {
	checkout: string;
	args: string[];
	operation?: string;
	timeout?: number;
}): Promise<string> => {
	const environment = Object.fromEntries(
		Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
	);
	try {
		const { stdout } = await executeFile(
			"git",
			[
				"--no-optional-locks",
				"-c",
				"core.hooksPath=/dev/null",
				"-c",
				"core.fsmonitor=false",
				"-c",
				"submodule.recurse=false",
				"-c",
				"maintenance.auto=false",
				"-c",
				"gc.auto=0",
				"-C",
				checkout,
				...args,
			],
			{
				env: {
					...environment,
					GIT_CONFIG_NOSYSTEM: "1",
					GIT_CONFIG_GLOBAL: "/dev/null",
					GIT_TERMINAL_PROMPT: "0",
					GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o StrictHostKeyChecking=yes",
					LC_ALL: "C",
				},
				encoding: "utf8",
				timeout,
				maxBuffer: 1024 * 1024,
			},
		);
		return stdout.trim();
	} catch {
		// Git stderr may contain credential-bearing local configuration.
		throw new Error(`Unable to ${operation} publication checkout with Git`);
	}
};

const inspectGit = (checkout: string, args: string[]): Promise<string> =>
	runGit({ checkout, args });

const entryAt = async (file: string) => {
	try {
		return await lstat(file);
	} catch (error) {
		if (isMatching({ code: "ENOENT" }, error)) return undefined;
		throw new Error("Unable to inspect publication checkout paths");
	}
};
export type PublicationGitContext = {
	config: PublicationConfig;
	job: PublicationJob;
	log: (message: string) => Promise<void>;
};
export type PublicationGitResult =
	| { kind: "no-change" }
	| { kind: "pushed"; commitId: string };
export type PublicationRecovery =
	| { kind: "ready" }
	| { kind: "resume-push"; commitId: string }
	| { kind: "already-pushed"; commitId: string };

/** Validate identity and output boundaries without changing files or contacting remotes. */
export const validatePublicationCheckout = async ({
	config,
	job,
	log,
}: PublicationGitContext): Promise<void> => {
	if (!path.isAbsolute(config.checkoutPath))
		throw new Error("Publication checkout path must be absolute");
	if (
		job.target.repository !== config.repository ||
		job.target.branch !== config.branch ||
		job.target.checkoutPath !== config.checkoutPath
	) {
		throw new Error(
			"Publication configuration no longer matches the saved job target",
		);
	}
	let checkout: string;
	let backend: string;
	try {
		checkout = await realpath(config.checkoutPath);
		backend = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
	} catch {
		throw new Error(
			"Publication checkout must already exist and be accessible",
		);
	}
	readArchiveCheckoutPath({
		environment: { ARCHIVE_CHECKOUT_PATH: checkout },
		repositoryRoot: backend,
	});
	if (!(await entryAt(checkout))?.isDirectory())
		throw new Error("Publication checkout must be a directory");
	// Dedicated normal clones only: reject linked worktrees, submodules, and .git symlinks.
	const gitDirectory = path.join(checkout, ".git");
	const gitEntry = await entryAt(gitDirectory);
	if (!gitEntry?.isDirectory() || gitEntry.isSymbolicLink()) {
		throw new Error(
			"Publication requires a dedicated checkout with its own .git directory",
		);
	}
	if (
		(await inspectGit(checkout, ["rev-parse", "--show-toplevel"])) !==
			checkout ||
		(await inspectGit(checkout, ["rev-parse", "--absolute-git-dir"])) !==
			gitDirectory
	) {
		throw new Error("Publication checkout must be the repository root");
	}
	await inspectGit(checkout, ["check-ref-format", "--branch", config.branch]);
	if (
		(await inspectGit(checkout, [
			"symbolic-ref",
			"--quiet",
			"--short",
			"HEAD",
		])) !== config.branch
	)
		throw new Error("Publication checkout is on the wrong branch");
	await inspectGit(checkout, ["rev-parse", "--verify", "HEAD^{commit}"]);
	for (const args of [
		["remote", "get-url", "--all", "origin"],
		["remote", "get-url", "--push", "--all", "origin"],
	]) {
		if ((await inspectGit(checkout, args)) !== config.repository)
			throw new Error(
				"Publication origin fetch and push URLs must match the configured repository exactly",
			);
	}
	for (const marker of [
		"MERGE_HEAD",
		"CHERRY_PICK_HEAD",
		"REVERT_HEAD",
		"BISECT_LOG",
		"rebase-apply",
		"rebase-merge",
		"sequencer",
	]) {
		if (await entryAt(path.join(gitDirectory, marker)))
			throw new Error("Finish the in-progress Git operation before publishing");
	}
	for (const directory of [
		"src",
		"src/res",
		"src/res/djs",
		"public",
		"public/assets",
		"public/assets/djs",
	]) {
		const entry = await entryAt(path.join(checkout, directory));
		if (entry !== undefined && (!entry.isDirectory() || entry.isSymbolicLink()))
			throw new Error(
				"Publication output directories must be real directories without symlinks",
			);
	}
	for (const file of [
		"src/res/djs_brief.json",
		"src/res/shows.json",
		"src/res/tags.json",
	]) {
		const entry = await entryAt(path.join(checkout, file));
		if (entry !== undefined && (!entry.isFile() || entry.isSymbolicLink()))
			throw new Error(
				"Publication JSON destinations must be regular files without symlinks",
			);
	}
	await log("Validated publication checkout, branch, origin, and output paths");
};

export const reconcilePublicationGit = (
	_context: PublicationGitContext,
	_previousJob: PublicationJob | undefined,
): Promise<PublicationRecovery> => {
	throw new Error("Not implemented: reconcilePublicationGit");
};

/** Fetch one branch and permit only a fast-forward, preserving local work on failure. */
export const synchronizePublicationCheckout = async (
	context: PublicationGitContext,
): Promise<void> => {
	await validatePublicationCheckout(context);
	const checkout = context.config.checkoutPath;
	if (
		(await inspectGit(checkout, ["diff", "--cached", "--name-only", "-z"])) !==
			"" ||
		(await inspectGit(checkout, ["ls-files", "--unmerged", "-z"])) !== ""
	) {
		throw new Error(
			"Resolve staged or unmerged changes before synchronizing publication",
		);
	}
	const remoteRef = `refs/remotes/origin/${context.config.branch}`;
	await runGit({
		checkout,
		args: [
			"fetch",
			"--no-tags",
			"--no-recurse-submodules",
			"--no-write-fetch-head",
			"--no-auto-maintenance",
			"--refmap=",
			"origin",
			`refs/heads/${context.config.branch}:${remoteRef}`,
		],
		operation: "fetch",
		timeout: 30000,
	});
	await context.log("Fetched publication branch");
	const remoteCommit = await inspectGit(checkout, [
		"rev-parse",
		"--verify",
		`${remoteRef}^{commit}`,
	]);
	const counts = (
		await inspectGit(checkout, [
			"rev-list",
			"--left-right",
			"--count",
			`HEAD...${remoteCommit}`,
		])
	).split(/\s+/);
	if (!isMatching([P.string.regex(/^\d+$/), P.string.regex(/^\d+$/)], counts))
		throw new Error("Unable to compare publication branch history");
	if (counts[0] !== "0")
		throw new Error(
			"Publication checkout has local commits; reconcile them before synchronizing",
		);
	if (counts[1] === "0") {
		await context.log(
			"Checkout already matches the fetched publication branch",
		);
		return;
	}
	await runGit({
		checkout,
		args: ["merge", "--ff-only", "--no-autostash", "--no-edit", remoteCommit],
		operation: "fast-forward",
	});
	await validatePublicationCheckout(context);
	await context.log(
		"Fast-forwarded checkout to the fetched publication branch",
	);
};

export const commitAndPushPublication = (
	_context: PublicationGitContext,
	_recovery: PublicationRecovery,
): Promise<PublicationGitResult> => {
	throw new Error("Not implemented: commitAndPushPublication");
};
