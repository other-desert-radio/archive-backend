import type { ModifyShowRequest } from "../../admin/routes/shows/index.js";
import { describeMutationFailure } from "./mutation-error.js";
import type { ShowsAdminRow } from "./shows.js";

export const modifyShow = async (
	request: ModifyShowRequest,
	fetcher: typeof fetch = fetch,
): Promise<ShowsAdminRow> => {
	const response = await fetcher("/api/admin/modify-show", {
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
				"saved",
			),
		);
	return (await response.json()) as ShowsAdminRow;
};
