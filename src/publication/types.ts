/** Decimal strings preserve PostgreSQL bigint revisions in JSON. */
export type PublicationRevision = string;
export type PublicationConfig = {
	enabled: boolean;
	repository: string;
	checkoutPath: string;
	branch: string;
	gitIdentity?: { name: string; email: string };
};
export type PublicationStage =
	| "queued"
	| "validating"
	| "synchronizing"
	| "exporting"
	| "committing"
	| "pushing"
	| "acknowledging";
export type PublicationOutcome =
	| "succeeded"
	| "no-change"
	| "failed"
	| "interrupted";
export type PublicationJobBase = {
	id: string;
	requestedBy: string;
	createdAt: string;
	target: Pick<PublicationConfig, "repository" | "checkoutPath" | "branch">;
	retryJobId?: string;
	revision?: PublicationRevision;
	commitId?: string;
};
export type PublicationJob = PublicationJobBase &
	(
		| { outcome: "running"; stage: PublicationStage }
		| {
				outcome: PublicationOutcome;
				stage: PublicationStage;
				completedAt: string;
				error?: string;
		  }
	);
export type PublicationLog = {
	sequence: number;
	timestamp: string;
	message: string;
};
export type PublicationJobDetail = {
	job: PublicationJob;
	logs: PublicationLog[];
	logsTruncated: boolean;
};
export type PublicationStatus = {
	enabled: boolean;
	branch: string;
	revision: PublicationRevision;
	publishedRevision: PublicationRevision;
	pending: boolean;
	latestJob?: PublicationJob;
};
export type PublicationEvent =
	| { type: "status"; status: PublicationStatus }
	| { type: "job"; detail: PublicationJobDetail };
export type PublicationStart = { requestedBy: string; retryJobId?: string };
