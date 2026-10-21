import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMatching } from "ts-pattern";
import { validatePublicationDestination } from "../checkout.js";
import { inspectGit } from "./commands.js";
import type { PublicationGitContext } from "./types.js";

const entryAt = async (file: string) => {
	try {
		return await lstat(file);
	} catch (error) {
		if (isMatching({ code: "ENOENT" }, error)) return undefined;
		throw new Error("Unable to inspect publication checkout paths");
	}
};

/**
 * Before any Git flow, verify the saved target, filesystem boundaries, dedicated
 * clone, branch, and origin. Inspect locally; do not fetch or change work here.
 */
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
	await validatePublicationDestination({
		checkoutPath: config.checkoutPath,
		repositoryRoot: fileURLToPath(new URL("../../../", import.meta.url)),
	});
	const checkout = await realpath(config.checkoutPath);
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
	await log("Validated publication checkout, branch, origin, and output paths");
};
