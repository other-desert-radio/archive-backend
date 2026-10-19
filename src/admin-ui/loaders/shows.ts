import type { AdminShowsJSON } from "../../admin/routes/shows/index.js";
import { apiFetch } from "./api-fetch.js";

/** Browser representation of the admin-only Show list response. */
export type ShowsAdminRow = Omit<AdminShowsJSON, "date" | "createdAt"> & {
	createdAt: string;
	date: string;
};

export const loadShows = async (
	fetcher: typeof fetch = apiFetch,
): Promise<ShowsAdminRow[]> => {
	const response = await fetcher("/api/admin/shows");

	if (!response.ok) {
		throw new Error("Unable to load shows");
	}

	return (await response.json()) as ShowsAdminRow[];
};
