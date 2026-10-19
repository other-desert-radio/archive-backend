import type { TagsJSON } from "../../json-transformers/index.js";
import { apiFetch } from "./api-fetch.js";

export type TagsAdminRow = TagsJSON & { showTitles?: string[] };

export const loadTags = async (
	fetcher: typeof fetch = apiFetch,
): Promise<TagsAdminRow[]> => {
	const response = await fetcher("/api/admin/tags");

	if (!response.ok) {
		throw new Error("Unable to load tags");
	}

	return (await response.json()) as TagsAdminRow[];
};
