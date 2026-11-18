import type { Special } from "../../admin/routes/specials/index.js";
import { apiFetch } from "./api-fetch.js";
export type SpecialsAdminRow = Special & { showTitles?: string[] };
export const loadSpecials = async (
	fetcher: typeof fetch = apiFetch,
): Promise<SpecialsAdminRow[]> => {
	const response = await fetcher("/api/admin/specials");
	if (!response.ok) throw new Error("Unable to load specials");
	return (await response.json()) as SpecialsAdminRow[];
};
