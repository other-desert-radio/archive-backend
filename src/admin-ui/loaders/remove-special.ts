import type {
	RemoveSpecialRequest,
	RemoveSpecialResponse,
	SpecialDeleteImpact,
} from "../../admin/routes/specials/index.js";
import { apiFetch } from "./api-fetch.js";
import { describeMutationFailure } from "./mutation-error.js";

export class SpecialDeleteConflictError extends Error {}

export const loadSpecialDeleteImpact = async (
	id: number,
	fetcher: typeof fetch = apiFetch,
): Promise<SpecialDeleteImpact> => {
	const response = await fetcher(`/api/admin/specials/${id}/delete-impact`);
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Special impact",
				"Please retry loading the impact.",
				"loaded",
			),
		);
	return (await response.json()) as SpecialDeleteImpact;
};

export const removeSpecial = async (
	request: RemoveSpecialRequest,
	fetcher: typeof fetch = apiFetch,
): Promise<RemoveSpecialResponse> => {
	const response = await fetcher("/api/admin/remove-special", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!response.ok) {
		const message = await describeMutationFailure(
			response,
			"Special",
			"Please try deleting the Special again.",
			"deleted",
		);
		throw response.status === 409
			? new SpecialDeleteConflictError(message)
			: new Error(message);
	}
	return (await response.json()) as RemoveSpecialResponse;
};
