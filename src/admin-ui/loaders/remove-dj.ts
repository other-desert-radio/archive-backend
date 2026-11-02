import type {
	DJDeleteImpact,
	RemoveDJRequest,
	RemoveDJResponse,
} from "../../admin/routes/djs/index.js";
import { apiFetch } from "./api-fetch.js";
import { describeMutationFailure } from "./mutation-error.js";

export class DJDeleteConflictError extends Error {}

export const loadDJDeleteImpact = async (
	id: number,
	fetcher: typeof fetch = apiFetch,
): Promise<DJDeleteImpact> => {
	const response = await fetcher(`/api/admin/djs/${id}/delete-impact`);
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"DJ impact",
				"Please retry loading the impact.",
				"loaded",
			),
		);
	return (await response.json()) as DJDeleteImpact;
};

export const removeDJ = async (
	request: RemoveDJRequest,
	fetcher: typeof fetch = apiFetch,
): Promise<RemoveDJResponse> => {
	const response = await fetcher("/api/admin/remove-dj", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!response.ok) {
		const message = await describeMutationFailure(
			response,
			"DJ",
			"Please try deleting the DJ again.",
			"deleted",
		);
		throw response.status === 409
			? new DJDeleteConflictError(message)
			: new Error(message);
	}
	return (await response.json()) as RemoveDJResponse;
};
