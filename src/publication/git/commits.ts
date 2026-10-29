import type { PublicationJob } from "../types.js";
import { inspectGit, pathsFromGit, runGit } from "./commands.js";
import { containsCommit, fetchPublicationBranch } from "./remote.js";
import type {
	PublicationGitContext,
	PublicationGitResult,
	PublicationRecovery,
} from "./types.js";
import { validatePublicationCheckout } from "./validation.js";

/** Exporter-owned paths only, including deleted files and ignored new assets. */
const generatedPaths = [
	"src/res/djs",
	"src/res/djs_brief.json",
	"src/res/shows.json",
	"src/res/tags.json",
	"src/res/data_versions.json",
	"public/assets/djs",
];
export const generatedPath = (file: string): boolean =>
	[
		"src/res/djs_brief.json",
		"src/res/shows.json",
		"src/res/tags.json",
		"src/res/data_versions.json",
	].includes(file) ||
	file.startsWith("src/res/djs/") ||
	file.startsWith("public/assets/djs/");

/** Verify job/revision trailers, one parent, and generated-only changes before trust. */
export const verifyPublisherCommit = async (
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

/**
 * After export, stage generated paths → commit → persist commit ID → push.
 * Recovery can skip the new commit or confirm an earlier push. Persisting the ID
 * before network I/O makes a lost push response recoverable on explicit retry.
 */
export const commitAndPushPublication = async (
	context: PublicationGitContext,
	recovery: PublicationRecovery,
): Promise<PublicationGitResult> => {
	await validatePublicationCheckout(context);
	const checkout = context.config.checkoutPath;
	// A confirmed remote commit needs acknowledgement, not another push.
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
		// Enumerate literal generated paths, including deletions and ignored assets.
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
