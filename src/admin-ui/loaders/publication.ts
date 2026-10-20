import type {
	PublicationEvent,
	PublicationJob,
	PublicationJobDetail,
	PublicationStatus,
} from "../../publication/index.js";
export type PublicationStreamOptions = {
	onEvent: (event: PublicationEvent) => void;
	onError: (error: unknown) => void;
	signal: AbortSignal;
};

export const loadPublicationStatus = (): Promise<PublicationStatus> => {
	throw new Error("Not implemented: loadPublicationStatus");
};

export const loadPublicationJob = (
	_jobId: string,
): Promise<PublicationJobDetail> => {
	throw new Error("Not implemented: loadPublicationJob");
};

export const startPublication = (
	_retryJobId?: string,
): Promise<PublicationJob> => {
	throw new Error("Not implemented: startPublication");
};

/**
 * Use apiFetch session handling and authenticated fetch streaming. Validate
 * incoming payloads; reconnect and re-read durable state without starting a job.
 * Abort ends observation only, never server-side execution.
 */
export const connectPublicationStream = (
	_options: PublicationStreamOptions,
): Promise<void> => {
	throw new Error("Not implemented: connectPublicationStream");
};
