import type { TagsJSON } from "../../../json-transformers/index.js";
import type { DJsAdminRow } from "../../loaders/djs.js";

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
export type SortDirection = "asc" | "desc";

const textFor = (dj: DJsAdminRow, column: DJSortColumn): string => {
	switch (column) {
		case "id":
			return String(dj.id);
		case "tags":
		case "shows":
			return dj[column].join(", ");
		default:
			return dj[column] ?? "";
	}
};

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
	const normalizedQuery = query.trim().toLowerCase();
	return normalizedQuery === ""
		? djs
		: djs.filter((dj) => getDJSearchValue(dj, tags).includes(normalizedQuery));
};

/** Returns a sorted copy of the DJ list, preserving the input array. */
export const sortDJs = (
	djs: DJsAdminRow[],
	column: DJSortColumn,
	direction: SortDirection,
): DJsAdminRow[] => {
	const multiplier = direction === "asc" ? 1 : -1;
	return [...djs].sort((left, right) => {
		let comparison: number;
		switch (column) {
			case "id":
				comparison = left.id - right.id;
				break;
			case "createdAt":
				comparison = left.createdAt.localeCompare(right.createdAt);
				break;
			case "tags":
			case "shows":
				comparison = (left[column][0] ?? -1) - (right[column][0] ?? -1);
				break;
			default:
				// Compare text alphabetically while treating uppercase and lowercase as equal.
				comparison = textFor(left, column).localeCompare(
					textFor(right, column),
					undefined,
					{ sensitivity: "base" },
				);
		}
		return comparison * multiplier;
	});
};
