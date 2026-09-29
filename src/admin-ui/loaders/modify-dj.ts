import type { EditDJForm } from "../components/dj/index.js";
import type { DJsAdminRow } from "./djs.js";
import { describeMutationFailure } from "./mutation-error.js";

/** Replaces a DJ's editable fields through the authenticated admin API. */
export const modifyDJ = async (
	request: EditDJForm,
	fetcher: typeof fetch = fetch,
): Promise<DJsAdminRow> => {
	const form = new FormData();
	form.append("id", String(request.id));
	form.append("title", request.title);
	form.append("bio", request.bio);
	form.append("tags", request.tags.join(","));
	form.append("socials", request.socials ?? "");
	form.append("showTitle", request.showTitle ?? "");
	form.append("showDescription", request.showDescription ?? "");
	form.append("removeImage", String(request.removeImage));
	if (request.image !== undefined) form.append("image", request.image);

	const response = await fetcher("/api/admin/modify-dj", {
		method: "POST",
		body: form,
	});
	if (!response.ok) {
		throw new Error(
			await describeMutationFailure(
				response,
				"DJ",
				"Please check the form and image, then try again.",
				"updated",
			),
		);
	}

	return (await response.json()) as DJsAdminRow;
};
