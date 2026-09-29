import type { TagsAdminRow } from "../../loaders/tags.js";
import { filterResourceRows } from "../shared/resource-views/index.js";

/** Returns Tags whose title or color matches a case-insensitive search query. */
export const filterTags = (tags: TagsAdminRow[], query: string) =>
	filterResourceRows(tags, query, (tag) => `${tag.title} ${tag.color}`);
