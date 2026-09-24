import type { CreateDJForm } from "../components/onboard-dj-utils.js";
import type { DJsAdminRow } from "./djs.js";
import { describeMutationFailure } from "./mutation-error.js";

/**
 * Creates a DJ through the authenticated admin API.
 *
 * @param request - The normalized DJ creation payload.
 * @param fetcher - Fetch implementation, injectable for focused tests.
 * @returns The newly created DJ.
 * @throws When the create endpoint returns an unsuccessful response.
 */
export const createDJ = async (
	request: CreateDJForm,
	fetcher: typeof fetch = fetch,
): Promise<DJsAdminRow> => {
	const form = new FormData();
	form.append("title", request.title);
	form.append("bio", request.bio);
	if (request.tags !== undefined) form.append("tags", request.tags.join(","));
	if (request.socials !== undefined) form.append("socials", request.socials);
	if (request.showTitle !== undefined)
		form.append("showTitle", request.showTitle);
	if (request.showDescription !== undefined)
		form.append("showDescription", request.showDescription);
	if (request.image !== undefined) form.append("image", request.image);

	const response = await fetcher("/api/admin/create-dj", {
		method: "POST",
		body: form,
	});

	if (!response.ok) {
		throw new Error(
			await describeMutationFailure(
				response,
				"DJ",
				"Please check the form and image, then try again.",
			),
		);
	}

	return (await response.json()) as DJsAdminRow;
};
