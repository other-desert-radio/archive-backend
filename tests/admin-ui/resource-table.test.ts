import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
	filterResourceRows,
	getNextSort,
	ResourceTable,
	type ResourceTableColumn,
	sortResourceRows,
} from "../../src/admin-ui/components/shared/resource-views/index.js";

type Row = { id: number; title: string };
const rows: Row[] = [
	{ id: 2, title: "Zulu" },
	{ id: 1, title: "Alpha" },
];

const columns: ResourceTableColumn<Row, "id" | "title">[] = [
	{
		key: "id",
		label: "id",
		render: (row) => row.id,
		compare: (left, right) => left.id - right.id,
	},
	{
		key: "title",
		label: "title",
		render: (row) => row.title,
		compare: (left, right) =>
			left.title.localeCompare(right.title, undefined, { sensitivity: "base" }),
	},
];

describe("resource table helpers", () => {
	test("filters trimmed queries case-insensitively", () => {
		expect(filterResourceRows(rows, " alpha ", (row) => row.title)).toEqual([
			rows[1],
		]);
	});

	test("sorts a copied array using the resource column comparator", () => {
		expect(
			sortResourceRows(rows, columns, "id", "asc").map((row) => row.id),
		).toEqual([1, 2]);
		expect(rows.map((row) => row.id)).toEqual([2, 1]);
	});

	test("toggles an active sort and starts a new column ascending", () => {
		expect(getNextSort("id", "desc", "id")).toEqual({
			column: "id",
			direction: "asc",
		});
		expect(getNextSort("id", "desc", "title")).toEqual({
			column: "title",
			direction: "asc",
		});
	});

	test("renders Edit actions for every row", () => {
		const html = renderToStaticMarkup(
			createElement(ResourceTable<Row, "id" | "title">, {
				rows,
				rowKey: (row) => row.id,
				caption: "Rows",
				columns,
				sortColumn: "id",
				sortDirection: "asc",
				onSort: () => undefined,
				onEdit: () => undefined,
			}),
		);
		expect(html.match(/>Edit<\/button>/g)).toHaveLength(rows.length);
	});
	test("renders Delete actions with optional Edit controls", () => {
		for (const withEdit of [true, false]) {
			const html = renderToStaticMarkup(
				createElement(ResourceTable<Row, "id" | "title">, {
					rows,
					rowKey: (row) => row.id,
					caption: "Rows",
					columns,
					sortColumn: "id",
					sortDirection: "asc",
					onSort: () => undefined,
					onEdit: withEdit ? () => undefined : undefined,
					onDelete: () => undefined,
				}),
			);
			expect(html.includes(">Edit</button>")).toBe(withEdit);
			expect(html.match(/>Delete<\/button>/g)).toHaveLength(rows.length);
		}
	});
});
