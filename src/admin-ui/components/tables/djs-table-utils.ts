import type { TagsJSON } from "../../../json-transformers/index.js";
import type { DJsAdminRow } from "../../loaders/djs.js";
import {
	filterResourceRows,
	type SortDirection,
	sortResourceRows,
} from "../resource-table.js";
import { djColumns } from "./djs-table.js";

export type DJSortColumn =
	| "id"
	| "createdAt"
	| "title"
	| "showTitle"
	| "showDescription"
	| "imagePath"
	| "tags"
	| "socials"
	| "bio"
	| "shows";
export type { SortDirection } from "../resource-table.js";

export const getDJSearchValue = (dj: DJsAdminRow, tags: TagsJSON[]): string => {
	const titles = dj.tags
		.map((id) => tags.find((tag) => tag.id === id)?.title)
		.filter((title): title is string => title !== undefined);
	return [
		dj.id,
		dj.title,
		dj.imagePath,
		dj.showTitle,
		dj.showDescription,
		dj.socials,
		dj.bio,
		...dj.tags,
		...titles,
	]
		.join(" ")
		.toLowerCase();
};

/** Returns DJs whose searchable fields or related tag titles match the query. */
export const filterDJs = (
	djs: DJsAdminRow[],
	query: string,
	tags: TagsJSON[],
) => {
	return filterResourceRows(djs, query, (dj) => getDJSearchValue(dj, tags));
};

/** Returns a sorted copy of the DJ list, preserving the input array. */
export const sortDJs = (
	djs: DJsAdminRow[],
	column: DJSortColumn,
	direction: SortDirection,
): DJsAdminRow[] => {
	return sortResourceRows(djs, djColumns, column, direction);
};
