import { inspectGit } from "./git/commands.js";
import type { PublicationConfig, PublicationTarget } from "./types.js";

const safeOrigin = (origin: string): boolean => {
	if (
		Array.from(origin).some(
			(character) =>
				character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
		)
	)
		return false;
	if (!origin.includes("://")) return true;
	try {
		const url = new URL(origin);
		return (
			!url.password &&
			!url.search &&
			!url.hash &&
			(url.protocol === "ssh:" || !url.username)
		);
	} catch {
		return false;
	}
};

/** Optional local metadata must never require a remote or alter the checkout. */
const inspectOptional = async (checkout: string, args: string[]) => {
	try {
		return (await inspectGit(checkout, args)) || undefined;
	} catch {
		// Non-Git destinations, detached HEAD, and missing origin are supported.
		return undefined;
	}
};

/** Resolve the current target without fetch, branch switching, staging, or commits. */
export const readPublicationTarget = async (
	config: PublicationConfig,
): Promise<PublicationTarget> => {
	if (config.mode === "remote")
		return {
			mode: "remote",
			checkoutPath: config.checkoutPath,
			repository: config.repository,
			branch: config.branch,
		};
	const target: PublicationTarget = {
		mode: "local",
		checkoutPath: config.checkoutPath,
	};
	if (
		(await inspectOptional(config.checkoutPath, [
			"rev-parse",
			"--is-inside-work-tree",
		])) !== "true"
	)
		return target;
	const branch = await inspectOptional(config.checkoutPath, [
		"symbolic-ref",
		"--quiet",
		"--short",
		"HEAD",
	]);
	const origin = await inspectOptional(config.checkoutPath, [
		"remote",
		"get-url",
		"origin",
	]);
	// Origins can contain credentials. Omit credential-bearing or multiline values
	// rather than saving secrets in job history or returning them to the browser.
	const repository = origin && safeOrigin(origin) ? origin : undefined;
	return {
		...target,
		...(branch ? { branch } : {}),
		...(repository ? { repository } : {}),
	};
};

export const samePublicationTarget = (
	left: PublicationTarget,
	right: PublicationTarget,
): boolean =>
	left.mode === right.mode &&
	left.checkoutPath === right.checkoutPath &&
	left.branch === right.branch &&
	left.repository === right.repository;
