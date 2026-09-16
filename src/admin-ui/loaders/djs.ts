import type { DJJSON } from "../../json-transformers/index.js";

export const loadDJs = async (
	fetcher: typeof fetch = fetch,
): Promise<DJJSON[]> => {
	const response = await fetcher("/api/admin/djs");

	if (!response.ok) {
		throw new Error("Unable to load DJs");
	}

	return (await response.json()) as DJJSON[];
};
