import type { PublicationJob } from "../types.js";
import { inspectGit, pathsFromGit, runGit } from "./commands.js";
import { generatedPath, verifyPublisherCommit } from "./commits.js";
import { containsCommit, fetchPublicationBranch } from "./remote.js";
import type { PublicationGitContext, PublicationRecovery } from "./types.js";
import { validatePublicationCheckout } from "./validation.js";

/**
 * Explicit retry: validate target → reconcile recognized staging → fetch → find
 * and verify the previous commit. Return ready for a fresh export, resume-push
 * for the one recognized outgoing commit, or already-pushed for acknowledgement.
 * Unknown staged work and outgoing history stop recovery instead of being lost.
 */
export const reconcilePublicationGit = async (
	context: PublicationGitContext,
	previousJob: PublicationJob | undefined,
	options: { readOnly?: boolean } = {},
): Promise<PublicationRecovery> => {
	if (previousJob === undefined) return { kind: "ready" };
	await validatePublicationCheckout(context);
	if (
		previousJob.target.mode === "local" ||
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
	// Remove only recognized generated staging; retain the working-tree files.
	if (staged.length > 0) {
		if (
			previousJob.revision === undefined ||
			staged.some((file) => !generatedPath(file)) ||
			(await inspectGit(checkout, ["ls-files", "--unmerged", "-z"])) !== ""
		)
			throw new Error("Unrecognized staged work blocks publication recovery");
		if (!options.readOnly)
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
	// A crash can occur after commit creation but before its ID is saved.
	// Job trailers let recovery find that commit without trusting arbitrary HEAD.
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
