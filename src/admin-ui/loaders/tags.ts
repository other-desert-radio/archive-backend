import type { TagsJSON } from "../../json-transformers/index.js";

export type TagsAdminRow = TagsJSON;

export const loadTags = async (
	fetcher: typeof fetch = fetch,
): Promise<TagsAdminRow[]> => {
	const response = await fetcher("/api/admin/tags");

	if (!response.ok) {
		throw new Error("Unable to load tags");
	}

	return (await response.json()) as TagsAdminRow[];
};
