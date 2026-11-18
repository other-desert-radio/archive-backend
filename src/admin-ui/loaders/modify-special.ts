import type { ModifySpecialRequest } from "../../admin/routes/specials/index.js";
import { apiFetch } from "./api-fetch.js";
import { describeMutationFailure } from "./mutation-error.js";
import type { SpecialsAdminRow } from "./specials.js";

export const modifySpecial = async (
	request: ModifySpecialRequest,
	fetcher: typeof fetch = apiFetch,
): Promise<SpecialsAdminRow> => {
	const response = await fetcher("/api/admin/modify-special", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Special",
				"Please check the form and try again.",
			),
		);
	return (await response.json()) as SpecialsAdminRow;
};
