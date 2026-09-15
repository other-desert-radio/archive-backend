import type { DJsJSON, TagsJSON } from "../../../json-transformers/index.js";

export type DJSortColumn =
	| "id"
	| "title"
	| "image"
	| "tags"
	| "socials"
	| "bio"
	| "shows";
export type SortDirection = "asc" | "desc";

const textFor = (dj: DJsJSON, column: DJSortColumn): string => {
	if (column === "id") return String(dj.id);
	if (column === "tags" || column === "shows") return dj[column].join(", ");
	return dj[column] ?? "";
};

export const getDJSearchValue = (dj: DJsJSON, tags: TagsJSON[]): string => {
	const titles = dj.tags
		.map((id) => tags.find((tag) => tag.id === id)?.title)
		.filter((title): title is string => title !== undefined);
	return [dj.id, dj.title, dj.image, dj.socials, dj.bio, ...dj.tags, ...titles]
		.join(" ")
		.toLowerCase();
};

/** Returns DJs whose searchable fields or related tag titles match the query. */
export const filterDJs = (djs: DJsJSON[], query: string, tags: TagsJSON[]) => {
	const normalizedQuery = query.trim().toLowerCase();
	return normalizedQuery === ""
		? djs
		: djs.filter((dj) => getDJSearchValue(dj, tags).includes(normalizedQuery));
};

/** Returns a sorted copy of the DJ list, preserving the input array. */
export const sortDJs = (
	djs: DJsJSON[],
	column: DJSortColumn,
	direction: SortDirection,
): DJsJSON[] => {
	const multiplier = direction === "asc" ? 1 : -1;
	return [...djs].sort((left, right) => {
		let comparison: number;
		switch (column) {
			case "id":
				comparison = left.id - right.id;
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
