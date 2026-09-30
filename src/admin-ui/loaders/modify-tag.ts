import type { ModifyTagRequest } from "../../admin/routes/tags/index.js";
import { describeMutationFailure } from "./mutation-error.js";
import type { TagsAdminRow } from "./tags.js";

export const modifyTag = async (
	request: ModifyTagRequest,
	fetcher: typeof fetch = fetch,
): Promise<TagsAdminRow> => {
	const response = await fetcher("/api/admin/modify-tag", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Tag",
				"Please check the form and try again.",
				"saved",
			),
		);
	return (await response.json()) as TagsAdminRow;
};
