import type { DJJSON } from "../../json-transformers/index.js";

export type DJsAdminRow = Omit<DJJSON, "createdAt"> & { createdAt: string };

export const loadDJs = async (
	fetcher: typeof fetch = fetch,
): Promise<DJsAdminRow[]> => {
	const response = await fetcher("/api/admin/djs");

	if (!response.ok) {
		throw new Error("Unable to load DJs");
	}

	return (await response.json()) as DJsAdminRow[];
};
