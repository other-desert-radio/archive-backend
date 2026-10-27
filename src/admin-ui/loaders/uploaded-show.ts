import type {
	ReviewedUploadFields,
	UploadedShowReview,
} from "../../admin/routes/mixcloud/index.js";
import { apiFetch } from "./api-fetch.js";
import type { ShowsAdminRow } from "./shows.js";

export type { ReviewedUploadFields, UploadedShowReview };

/** Existing upload ID → validated review data; never sends media or uploads again. */
export const prepareUploadedShow = async (
	_uploadId: number,
	_fetcher: typeof fetch = apiFetch,
): Promise<UploadedShowReview> => {
	throw new Error("Not implemented: prepareUploadedShow");
};

/** Reviewed editorial fields → persisted Show; retries use the same upload ID. */
export const saveUploadedShow = async (
	_uploadId: number,
	_reviewed: ReviewedUploadFields,
	_fetcher: typeof fetch = apiFetch,
): Promise<ShowsAdminRow> => {
	throw new Error("Not implemented: saveUploadedShow");
};
