import type { CreateDJRequest } from "../../admin/routes/djs/types.js";
import type { DJJSON } from "../../json-transformers/index.js";

/**
 * Creates a DJ through the authenticated admin API.
 *
 * @param request - The normalized DJ creation payload.
 * @param fetcher - Fetch implementation, injectable for focused tests.
 * @returns The newly created DJ.
 * @throws When the create endpoint returns an unsuccessful response.
 */
export const createDJ = async (
	request: CreateDJRequest,
	fetcher: typeof fetch = fetch,
): Promise<DJJSON> => {
	const response = await fetcher("/api/admin/create-dj", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(request),
	});

	if (!response.ok) {
		throw new Error("Unable to create DJ");
	}

	return (await response.json()) as DJJSON;
};
