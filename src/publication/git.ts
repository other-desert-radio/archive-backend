import { execFile } from "node:child_process";
import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { isMatching, P } from "ts-pattern";
import { readArchiveCheckoutPath } from "./config.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationStage,
} from "./types.js";

const executeFile = promisify(execFile);

/** Use argv, fixed safeguards, and sanitized errors for local and network commands. */
const runGit = async ({
	checkout,
	args,
	operation = "inspect",
	timeout = 10000,
	identity,
}: {
	checkout: string;
	args: string[];
	operation?: string;
	timeout?: number;
	identity?: PublicationConfig["gitIdentity"];
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
				`safe.directory=${checkout}`,
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
				...(identity
					? [
							"-c",
							`user.name=${identity.name}`,
							"-c",
							`user.email=${identity.email}`,
						]
					: []),
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
	recordCommit: (commitId: string) => Promise<void>;
	updateStage: (stage: PublicationStage) => Promise<void>;
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
	const currentBranch = await inspectGit(checkout, [
		"symbolic-ref",
		"--quiet",
		"--short",
		"HEAD",
	]);
	if (currentBranch !== config.branch)
		throw new Error(
			`Publication checkout is on branch "${currentBranch}", but publication is configured for branch "${config.branch}".`,
		);
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

/** Exporter-owned paths only, including deleted files and ignored new assets. */
const generatedPaths = [
	"src/res/djs",
	"src/res/djs_brief.json",
	"src/res/shows.json",
	"src/res/tags.json",
	"public/assets/djs",
];
const generatedPath = (file: string): boolean =>
	[
		"src/res/djs_brief.json",
		"src/res/shows.json",
		"src/res/tags.json",
	].includes(file) ||
	file.startsWith("src/res/djs/") ||
	file.startsWith("public/assets/djs/");
const pathsFromGit = (output: string): string[] =>
	output.split("\0").filter(Boolean);
const containsCommit = async (
	checkout: string,
	ancestor: string,
	descendant: string,
): Promise<boolean> =>
	(await inspectGit(checkout, [
		"rev-list",
		"--count",
		`${descendant}..${ancestor}`,
	])) === "0";

/** A new non-main publication branch may start at the verified remote main. */
const fetchPublicationBranch = async (
	context: PublicationGitContext,
): Promise<{ commit: string; missing: boolean }> => {
	const checkout = context.config.checkoutPath;
	const branch = context.config.branch;
	const advertised = await runGit({
		checkout,
		args: ["ls-remote", "--refs", "origin", `refs/heads/${branch}`],
		operation: "read remote branch",
		timeout: 30000,
	});
	const missing = advertised === "";
	let source = branch;
	if (missing) {
		if (
			branch !== "publish-dev" ||
			(await inspectGit(checkout, [
				"for-each-ref",
				"--format=%(objectname)",
				`refs/remotes/origin/${branch}`,
			])) !== ""
		) {
			throw new Error("Configured publication branch is missing from origin");
		}
		source = "main";
	}
	const remoteRef = `refs/remotes/origin/${source}`;
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
			`refs/heads/${source}:${remoteRef}`,
		],
		operation: "fetch",
		timeout: 30000,
	});
	const commit = await inspectGit(checkout, [
		"rev-parse",
		"--verify",
		`${remoteRef}^{commit}`,
	]);
	await context.log("Fetched publication branch");
	return { commit, missing };
};

const verifyPublisherCommit = async (
	context: PublicationGitContext,
	commit: string,
	previous: PublicationJob,
): Promise<void> => {
	const checkout = context.config.checkoutPath;
	if (previous.revision === undefined)
		throw new Error("Interrupted publication has no captured revision");
	const message = await inspectGit(checkout, [
		"show",
		"-s",
		"--format=%B",
		commit,
	]);
	const jobLines = message
		.split("\n")
		.filter((line) => line.startsWith("Archive-Publication-Job: "));
	const revisionLines = message
		.split("\n")
		.filter((line) => line.startsWith("Archive-Publication-Revision: "));
	if (
		jobLines.length !== 1 ||
		revisionLines.length !== 1 ||
		revisionLines[0] !== `Archive-Publication-Revision: ${previous.revision}` ||
		(jobLines[0] !== `Archive-Publication-Job: ${previous.id}` &&
			previous.commitId !== commit)
	) {
		throw new Error("Unrecognized interrupted publication commit");
	}
	const parents = (
		await inspectGit(checkout, ["rev-list", "--parents", "-n", "1", commit])
	).split(" ");
	if (parents.length !== 2)
		throw new Error("Publisher commits must have exactly one parent");
	const changed = pathsFromGit(
		await inspectGit(checkout, [
			"diff-tree",
			"--no-commit-id",
			"--name-only",
			"--no-renames",
			"-r",
			"-z",
			commit,
		]),
	);
	if (changed.length === 0 || changed.some((file) => !generatedPath(file)))
		throw new Error("Interrupted commit changes unrecognized paths");
};

export const reconcilePublicationGit = async (
	context: PublicationGitContext,
	previousJob: PublicationJob | undefined,
): Promise<PublicationRecovery> => {
	if (previousJob === undefined) return { kind: "ready" };
	await validatePublicationCheckout(context);
	if (
		previousJob.target.repository !== context.config.repository ||
		previousJob.target.branch !== context.config.branch ||
		previousJob.target.checkoutPath !== context.config.checkoutPath
	) {
		throw new Error(
			"Interrupted publication target differs from the retry target",
		);
	}
	const checkout = context.config.checkoutPath;
	const staged = pathsFromGit(
		await inspectGit(checkout, ["diff", "--cached", "--name-only", "-z"]),
	);
	if (staged.length > 0) {
		if (
			previousJob.revision === undefined ||
			staged.some((file) => !generatedPath(file)) ||
			(await inspectGit(checkout, ["ls-files", "--unmerged", "-z"])) !== ""
		)
			throw new Error("Unrecognized staged work blocks publication recovery");
		await runGit({
			checkout,
			args: [
				"restore",
				"--staged",
				"--source=HEAD",
				"--",
				...staged.map((file) => `:(literal)${file}`),
			],
			operation: "reconcile generated staging",
		});
	}
	const remote = await fetchPublicationBranch(context);
	const outgoing = (
		await inspectGit(checkout, [
			"rev-list",
			"--reverse",
			`${remote.commit}..HEAD`,
		])
	)
		.split("\n")
		.filter(Boolean);
	let candidate = previousJob.commitId;
	if (candidate === undefined && previousJob.revision !== undefined) {
		const found = (
			await inspectGit(checkout, [
				"log",
				"--all",
				"--format=%H",
				"--max-count=2",
				`--grep=^Archive-Publication-Job: ${previousJob.id}$`,
			])
		)
			.split("\n")
			.filter(Boolean);
		if (found.length > 1)
			throw new Error("Multiple commits claim the interrupted publication job");
		candidate = found[0];
	}
	if (candidate === undefined) {
		if (outgoing.length !== 0)
			throw new Error(
				"Unrecognized outgoing commits block publication recovery",
			);
		return { kind: "ready" };
	}
	// A no-change first publication can reference the already trusted remote main.
	const main = await inspectGit(checkout, [
		"for-each-ref",
		"--format=%(objectname)",
		"refs/remotes/origin/main",
	]);
	const baseline =
		previousJob.commitId === candidate &&
		candidate === main &&
		previousJob.revision !== undefined;
	if (!baseline) await verifyPublisherCommit(context, candidate, previousJob);
	if (
		(await containsCommit(checkout, candidate, remote.commit)) &&
		!remote.missing
	) {
		if (outgoing.length !== 0)
			throw new Error(
				"Unrecognized outgoing commits block publication recovery",
			);
		await context.log("Confirmed interrupted publication is already on origin");
		return { kind: "already-pushed", commitId: candidate };
	}
	const head = await inspectGit(checkout, ["rev-parse", "HEAD"]);
	if (
		head !== candidate ||
		(!baseline && (outgoing.length !== 1 || outgoing[0] !== candidate)) ||
		!(await containsCommit(checkout, remote.commit, candidate))
	)
		throw new Error(
			"Interrupted commit cannot be pushed without rewriting or including unrecognized history",
		);
	await context.log(
		"Recognized interrupted publication commit for explicit retry",
	);
	return { kind: "resume-push", commitId: candidate };
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
	const { commit: remoteCommit } = await fetchPublicationBranch(context);
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

/** Commit only exporter-owned files; record the commit durably before pushing. */
export const commitAndPushPublication = async (
	context: PublicationGitContext,
	recovery: PublicationRecovery,
): Promise<PublicationGitResult> => {
	await validatePublicationCheckout(context);
	const checkout = context.config.checkoutPath;
	if (recovery.kind === "already-pushed") {
		await context.recordCommit(recovery.commitId);
		return { kind: "pushed", commitId: recovery.commitId };
	}
	let commitId: string;
	if (recovery.kind === "resume-push") {
		commitId = recovery.commitId;
	} else {
		if (context.job.revision === undefined)
			throw new Error("Publication commit requires a captured revision");
		if (
			(await inspectGit(checkout, [
				"diff",
				"--cached",
				"--name-only",
				"-z",
			])) !== ""
		)
			throw new Error("Staged work blocks publication commit");
		const remote = await fetchPublicationBranch(context);
		const head = await inspectGit(checkout, ["rev-parse", "HEAD"]);
		if (head !== remote.commit)
			throw new Error("Remote changed during export; retry publication");
		await context.updateStage("committing");
		const candidates = [
			...new Set(
				pathsFromGit(
					await inspectGit(checkout, [
						"ls-files",
						"--cached",
						"--others",
						"-z",
						"--",
						...generatedPaths,
					]),
				),
			),
		];
		if (candidates.some((file) => !generatedPath(file)))
			throw new Error("Unrecognized generated output path");
		for (let offset = 0; offset < candidates.length; offset += 100) {
			await runGit({
				checkout,
				args: [
					"add",
					"--all",
					"--force",
					"--",
					...candidates
						.slice(offset, offset + 100)
						.map((file) => `:(literal)${file}`),
				],
				operation: "stage generated files",
			});
		}
		const staged = pathsFromGit(
			await inspectGit(checkout, ["diff", "--cached", "--name-only", "-z"]),
		);
		if (staged.some((file) => !generatedPath(file)))
			throw new Error("Unrelated staged files block publication commit");
		if (staged.length === 0) {
			if (!remote.missing) {
				await context.log(
					"Generated files already match origin; no commit needed",
				);
				return { kind: "no-change" };
			}
			// The generated snapshot already matches main; create the new target ref only.
			commitId = head;
		} else {
			await runGit({
				checkout,
				args: [
					"-c",
					"commit.gpgSign=false",
					"commit",
					"--no-verify",
					"-m",
					`Publish archive\n\nArchive-Publication-Job: ${context.job.id}\nArchive-Publication-Revision: ${context.job.revision}`,
				],
				identity: context.config.gitIdentity,
				operation: "commit generated files",
			});
			commitId = await inspectGit(checkout, ["rev-parse", "HEAD"]);
			await verifyPublisherCommit(context, commitId, {
				...context.job,
				commitId,
			});
		}
	}
	await context.recordCommit(commitId);
	await context.updateStage("pushing");
	// Re-fetch immediately before push; allow only this one recognized commit.
	const remote = await fetchPublicationBranch(context);
	const head = await inspectGit(checkout, ["rev-parse", "HEAD"]);
	if (
		head !== commitId ||
		!(await containsCommit(checkout, remote.commit, commitId))
	)
		throw new Error("Remote or local history changed before push");
	const outgoing = (
		await inspectGit(checkout, ["rev-list", `${remote.commit}..HEAD`])
	)
		.split("\n")
		.filter(Boolean);
	if (outgoing.length > 1 || outgoing.some((commit) => commit !== commitId))
		throw new Error("Unrecognized outgoing commits block publication push");
	await runGit({
		checkout,
		args: [
			"-c",
			"remote.origin.mirror=false",
			"push",
			"--porcelain",
			"--no-follow-tags",
			"--no-recurse-submodules",
			"--no-verify",
			"origin",
			`${commitId}:refs/heads/${context.config.branch}`,
		],
		operation: "push",
		timeout: 30000,
	});
	await context.log("Publication pushed to origin");
	return { kind: "pushed", commitId };
};
