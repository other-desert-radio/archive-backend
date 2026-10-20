import type { PublicationConfig, PublicationJob } from "./types.js";
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

export const validatePublicationCheckout = (
	_context: PublicationGitContext,
): Promise<void> => {
	throw new Error("Not implemented: validatePublicationCheckout");
};

export const reconcilePublicationGit = (
	_context: PublicationGitContext,
	_previousJob: PublicationJob | undefined,
): Promise<PublicationRecovery> => {
	throw new Error("Not implemented: reconcilePublicationGit");
};

export const synchronizePublicationCheckout = (
	_context: PublicationGitContext,
): Promise<void> => {
	throw new Error("Not implemented: synchronizePublicationCheckout");
};

export const commitAndPushPublication = (
	_context: PublicationGitContext,
	_recovery: PublicationRecovery,
): Promise<PublicationGitResult> => {
	throw new Error("Not implemented: commitAndPushPublication");
};
