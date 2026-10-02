import type {
	RemoveTagRequest,
	RemoveTagResponse,
	TagDeleteImpact,
} from "../../admin/routes/tags/index.js";
import { describeMutationFailure } from "./mutation-error.js";

export const loadTagDeleteImpact = async (
	id: number,
	fetcher: typeof fetch = fetch,
): Promise<TagDeleteImpact> => {
	const response = await fetcher(`/api/admin/tags/${id}/delete-impact`);
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Tag impact",
				"Please retry loading the impact.",
				"loaded",
			),
		);
	return (await response.json()) as TagDeleteImpact;
};

export const removeTag = async (
	request: RemoveTagRequest,
	fetcher: typeof fetch = fetch,
): Promise<RemoveTagResponse> => {
	const response = await fetcher("/api/admin/remove-tag", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Tag",
				"Please try deleting the tag again.",
				"deleted",
			),
		);
	return (await response.json()) as RemoveTagResponse;
};
