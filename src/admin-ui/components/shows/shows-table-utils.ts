import type { ShowsAdminRow } from "../../loaders/shows.js";
import {
	filterResourceRows,
	type SortDirection,
	sortResourceRows,
} from "../shared/resource-table.js";
import { formatDuration, formatUTCDate } from "../shared/table-formatters.js";
import { showColumns } from "./shows-table.js";

export type ShowSortColumn =
	| "id"
	| "createdAt"
	| "title"
	| "date"
	| "duration"
	| "image"
	| "djs"
	| "tags"
	| "url";
export type { SortDirection } from "../shared/resource-table.js";

export const getShowSearchValue = (
	show: ShowsAdminRow,
	djTitlesById: Map<number, string>,
	tagTitlesById: Map<number, string>,
): string =>
	[
		show.id,
		show.createdAt,
		show.title,
		formatUTCDate(show.date),
		formatDuration(show.duration),
		show.image,
		show.url,
		...show.djs,
		...show.djs.map((id) => djTitlesById.get(id)),
		...show.tags,
		...show.tags.map((id) => tagTitlesById.get(id)),
	]
		.filter((value): value is string | number => value !== undefined)
		.join(" ");

/** Filters shows by displayed values and resolved related resource names. */
export const filterShows = (
	shows: ShowsAdminRow[],
	query: string,
	djTitlesById: Map<number, string>,
	tagTitlesById: Map<number, string>,
) =>
	filterResourceRows(shows, query, (show) =>
		getShowSearchValue(show, djTitlesById, tagTitlesById),
	);

/** Returns a sorted copy of the Show list, retaining stable equal-value order. */
export const sortShows = (
	shows: ShowsAdminRow[],
	column: ShowSortColumn,
	direction: SortDirection,
) => sortResourceRows(shows, showColumns, column, direction);
