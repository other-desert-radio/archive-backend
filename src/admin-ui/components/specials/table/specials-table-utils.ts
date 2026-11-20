import type { SpecialsAdminRow } from "../../../loaders/specials.js";
import { filterResourceRows } from "../../shared/resource-views/index.js";
export type SpecialSortColumn = "id" | "title" | "description" | "shows";
export const filterSpecials = (rows: SpecialsAdminRow[], query: string) =>
	filterResourceRows(rows, query, (row) =>
		[row.title, ...(row.showTitles ?? [])].join(" "),
	);
