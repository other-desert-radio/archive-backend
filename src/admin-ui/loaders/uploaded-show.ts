import { isMatching, P } from "ts-pattern";
import type {
	ReviewedUploadFields,
	UploadedShowReview,
} from "../../admin/routes/mixcloud/index.js";
import { ReviewedUploadFieldsPattern } from "../../admin/routes/mixcloud/types.js";
import { UploadedCloudcastPattern } from "../../mixcloud/cloudcast.js";
import { apiFetch } from "./api-fetch.js";
import { describeMutationFailure } from "./mutation-error.js";
import type { ShowsAdminRow } from "./shows.js";

export type { ReviewedUploadFields, UploadedShowReview };

const timestamp = P.string.and(
	P.when(
		(value) => typeof value === "string" && Number.isFinite(Date.parse(value)),
	),
);

/** Existing upload ID → validated review data; never sends media or uploads again. */
export const prepareUploadedShow = async (
	uploadId: number,
	fetcher: typeof fetch = apiFetch,
): Promise<UploadedShowReview> => {
	let response: Response;
	try {
		response = await fetcher(
			`/api/admin/mixcloud/uploads/${uploadId}/prepare`,
			{ method: "POST" },
		);
	} catch {
		throw new Error(
			"Uploaded to Mixcloud, but we were unable to fetch the show.",
		);
	}
	if (!response.ok) {
		const body: unknown = await response.json().catch(() => undefined);
		const message = isMatching({ error: P.string.minLength(1) }, body)
			? body.error
			: "Uploaded to Mixcloud, but we were unable to fetch the show.";
		const status = `HTTP ${response.status}${response.statusText ? ` (${response.statusText})` : ""}`;
		throw new Error(`${message}\n\nStatus: ${status}`);
	}
	const result: unknown = await response.json().catch(() => undefined);
	if (
		!isMatching(
			{
				uploadId: P.number,
				editorial: ReviewedUploadFieldsPattern,
				mixcloud: UploadedCloudcastPattern,
			},
			result,
		) ||
		result.uploadId !== uploadId
	)
		throw new Error(
			"Mixcloud review data was unreadable. Retry loading details without uploading again.",
		);
	return result;
};

/** Reviewed editorial fields → persisted Show; retries use the same upload ID. */
export const saveUploadedShow = async (
	uploadId: number,
	reviewed: ReviewedUploadFields,
	fetcher: typeof fetch = apiFetch,
): Promise<ShowsAdminRow> => {
	let response: Response;
	try {
		response = await fetcher(`/api/admin/mixcloud/uploads/${uploadId}/save`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(reviewed),
		});
	} catch {
		throw new Error(
			"Unable to confirm the archive save. Retry Save; this will not upload to Mixcloud again.",
		);
	}
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Show",
				"Retry Save without uploading again.",
				"saved",
			),
		);
	const result: unknown = await response.json().catch(() => undefined);
	if (
		!isMatching(
			{
				show: {
					id: P.number.int().positive(),
					title: P.string,
					description: P.optional(P.string),
					date: timestamp,
					createdAt: timestamp,
					duration: P.number.int().positive(),
					image: P.string,
					mixcloud_image_small: P.string,
					mixcloud_image_large: P.string,
					url: P.string,
					djs: P.array(P.number),
					tags: P.array(P.number),
				},
			},
			result,
		)
	)
		throw new Error(
			"The archive save response was unreadable. Retry Save; this will not upload to Mixcloud again.",
		);
	const { description, ...show } = result.show;
	return { ...show, ...(description === undefined ? {} : { description }) };
};
