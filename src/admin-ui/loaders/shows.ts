import type { ShowsJSON } from "../../json-transformers/index.js";

/** Browser representation of the admin-only Show list response. */
export type ShowsAdminRow = Omit<ShowsJSON, "date"> & {
	createdAt: string;
	date: string;
};

export const loadShows = async (
	fetcher: typeof fetch = fetch,
): Promise<ShowsAdminRow[]> => {
	const response = await fetcher("/api/admin/shows");

	if (!response.ok) {
		throw new Error("Unable to load shows");
	}

	return (await response.json()) as ShowsAdminRow[];
};
