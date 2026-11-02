import type {
	RemoveShowRequest,
	RemoveShowResponse,
} from "../../admin/routes/shows/index.js";
import { apiFetch } from "./api-fetch.js";
import { describeMutationFailure } from "./mutation-error.js";

export const removeShow = async (
	request: RemoveShowRequest,
	fetcher: typeof fetch = apiFetch,
): Promise<RemoveShowResponse> => {
	const response = await fetcher("/api/admin/remove-show", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Show",
				"Please try deleting the show again.",
				"deleted",
			),
		);
	return (await response.json()) as RemoveShowResponse;
};
