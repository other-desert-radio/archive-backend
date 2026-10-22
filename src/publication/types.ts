/** Decimal strings preserve PostgreSQL bigint revisions in JSON. */
export type PublicationRevision = string;
export type PublicationMode = "local" | "remote";
/** Saved destination; local Git metadata describes the checkout when available. */
export type PublicationTarget =
	| {
			mode: "local";
			checkoutPath: string;
			repository?: string;
			branch?: string;
	  }
	| {
			mode: "remote";
			checkoutPath: string;
			repository: string;
			branch: string;
	  };
/** Local publication uses the existing checkout; remote publication adds Git settings. */
export type PublicationConfig =
	| { mode: "local"; checkoutPath: string }
	| {
			mode: "remote";
			checkoutPath: string;
			repository: string;
			branch: string;
			gitIdentity?: { name: string; email: string };
	  };
export type RemotePublicationConfig = Extract<
	PublicationConfig,
	{ mode: "remote" }
>;
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
	target: PublicationTarget;
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
	mode: PublicationMode;
	target: PublicationTarget;
	revision: PublicationRevision;
	publishedRevision: PublicationRevision;
	pending: boolean;
	latestJob?: PublicationJob;
};
export type PublicationEvent =
	| { type: "status"; status: PublicationStatus }
	| { type: "job"; detail: PublicationJobDetail };
export type PublicationStart = {
	requestedBy: string;
	retryJobId?: string;
	previewId?: string;
};

export type PublicationChanges = Record<
	"tags" | "shows" | "djs",
	{ added: string[]; changed: string[]; removed: string[] }
>;
export type PublicationPreview = {
	id: string;
	expiresAt: string;
	revision: PublicationRevision;
	changes: PublicationChanges;
};
