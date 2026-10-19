import type { DJJSON } from "../../json-transformers/index.js";
import { apiFetch } from "./api-fetch.js";

export type DJsAdminRow = Omit<DJJSON, "createdAt"> & {
	createdAt: string;
	/** Direct DJ tag assignments; `tags` also includes tags inherited from shows. */
	directTags?: number[];
};

export const loadDJs = async (
	fetcher: typeof fetch = apiFetch,
): Promise<DJsAdminRow[]> => {
	const response = await fetcher("/api/admin/djs");

	if (!response.ok) {
		throw new Error("Unable to load DJs");
	}

	return (await response.json()) as DJsAdminRow[];
};
