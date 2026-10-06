import type { ResolveMixcloudTagsResponse } from "../../admin/routes/tags/index.js";

export type { ResolveMixcloudTagsResponse } from "../../admin/routes/tags/index.js";
export type ValidateTagsResult = {
	valid: string[];
	invalid: string[];
};

/**
 * Validates submitted tag titles against the authenticated admin API.
 *
 * @param tags - Trimmed or raw tag titles to validate.
 * @param fetcher - Fetch implementation, injectable for focused tests.
 * @returns The submitted titles split into existing and missing tags.
 * @throws When the validation endpoint returns an unsuccessful response.
 */
export const validateTags = async (
	tags: string[],
	fetcher: typeof fetch = fetch,
): Promise<ValidateTagsResult> => {
	const response = await fetcher("/api/admin/validate-tags", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ tags }),
	});

	if (!response.ok) {
		throw new Error("Unable to validate tags");
	}

	return (await response.json()) as ValidateTagsResult;
};

/** Resolves source keys into canonical archive tag chips. */
export const resolveMixcloudTags = async (
	mixcloudKeys: string[],
	fetcher: typeof fetch = fetch,
): Promise<ResolveMixcloudTagsResponse> => {
	const response = await fetcher("/api/admin/validate-tags", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ mixcloud_keys: mixcloudKeys }),
	});
	if (!response.ok) throw new Error("Unable to resolve Mixcloud tags");
	return (await response.json()) as ResolveMixcloudTagsResponse;
};
