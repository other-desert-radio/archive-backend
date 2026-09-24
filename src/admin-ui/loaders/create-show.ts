import type { CreateShowForm } from "../components/shows/onboard-show-utils.js";
import { describeMutationFailure } from "./mutation-error.js";
import type { ShowsAdminRow } from "./shows.js";

export const createShow = async (
	request: CreateShowForm,
	fetcher: typeof fetch = fetch,
): Promise<ShowsAdminRow> => {
	const response = await fetcher("/api/admin/create-show", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});
	if (!response.ok)
		throw new Error(
			await describeMutationFailure(
				response,
				"Show",
				"Please check the form and try again.",
			),
		);
	return (await response.json()) as ShowsAdminRow;
};
