import type {
	PublicationJobDetail,
	PublicationStatus,
} from "../../../publication/index.js";
/** State outlives modal visibility; closing the modal never cancels a job. */
export type PublicationView = {
	status?: PublicationStatus;
	detail?: PublicationJobDetail;
	loading: boolean;
	starting: boolean;
	connected: boolean;
	error?: string;
	refresh: () => Promise<void>;
	start: (retryJobId?: string) => Promise<void>;
};

export const usePublication = (): PublicationView => {
	throw new Error("Not implemented: usePublication");
};
