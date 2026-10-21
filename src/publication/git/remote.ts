import { isMatching, P } from "ts-pattern";
import { inspectGit, runGit } from "./commands.js";
import type { PublicationGitContext } from "./types.js";
import { validatePublicationCheckout } from "./validation.js";

/** True when descendant includes ancestor; history must never be rewritten. */
export const containsCommit = async (
	checkout: string,
	ancestor: string,
	descendant: string,
): Promise<boolean> =>
	(await inspectGit(checkout, [
		"rev-list",
		"--count",
		`${descendant}..${ancestor}`,
	])) === "0";

/**
 * Fetch only the configured branch. A never-published publish-dev branch may
 * start from remote main; other missing branches fail instead of guessing.
 */
export const fetchPublicationBranch = async (
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

/**
 * Normal publication: validate → reject staged work → fetch → fast-forward.
 * Local commits or conflicts stop the flow without reset, rebase, or autostash.
 * The runner captures and exports its database snapshot after this returns.
 */
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
