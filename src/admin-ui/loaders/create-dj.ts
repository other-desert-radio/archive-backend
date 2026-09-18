import { isMatching, P } from "ts-pattern";
import type { DJJSON } from "../../json-transformers/index.js";
import type { CreateDJForm } from "../components/onboard-dj-utils.js";

type CreateDJErrorResponse = {
	error?: unknown;
};

const describeCreateDJFailure = async (response: Response): Promise<string> => {
	let serverError: string | undefined;

	try {
		const body = (await response.json()) as CreateDJErrorResponse;
		if (isMatching({ error: P.string.minLength(1) }, body)) {
			serverError = body.error;
		}
	} catch {
		// Use the HTTP status when the response has no readable JSON body.
	}

	const status = `HTTP ${response.status}${
		response.statusText === "" ? "" : ` (${response.statusText})`
	}`;
	if (serverError === undefined) {
		return `DJ could not be created. The server returned ${status}. Please check the form and image, then try again.`;
	}

	return `DJ could not be created. The server returned ${status}: ${serverError}. Please correct this issue and try again.`;
};

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
): Promise<DJJSON> => {
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
		throw new Error(await describeCreateDJFailure(response));
	}

	return (await response.json()) as DJJSON;
};
