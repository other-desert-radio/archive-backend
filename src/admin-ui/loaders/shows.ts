import type { ShowsJSON } from "../../json-transformers/index.js";

export type ShowsAdminRow = Omit<ShowsJSON, "date"> & { date: string };

export const loadShows = async (
	fetcher: typeof fetch = fetch,
): Promise<ShowsAdminRow[]> => {
	const response = await fetcher("/api/admin/shows");

	if (!response.ok) {
		throw new Error("Unable to load shows");
	}

	return (await response.json()) as ShowsAdminRow[];
};
