import type {
	PublicationJob,
	PublicationStage,
	RemotePublicationConfig,
} from "../types.js";

/** Runner-owned job state and persistence callbacks shared by Git flows. */
export type PublicationGitContext = {
	config: RemotePublicationConfig;
	job: PublicationJob;
	log: (message: string) => Promise<void>;
	recordCommit: (commitId: string) => Promise<void>;
	updateStage: (stage: PublicationStage) => Promise<void>;
};

export type PublicationGitResult =
	| { kind: "no-change" }
	| { kind: "pushed"; commitId: string };

/** Recovery decides whether to export anew, resume a push, or acknowledge it. */
export type PublicationRecovery =
	| { kind: "ready" }
	| { kind: "resume-push"; commitId: string }
	| { kind: "already-pushed"; commitId: string };
