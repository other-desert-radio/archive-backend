import { describe, expect, test } from "bun:test";
import { isValidElement, type ReactNode } from "react";
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

type ElementProps = { children?: ReactNode; onClick?: () => void };

const findActionButton = (
	node: ReactNode,
	label: string,
): ElementProps | undefined => {
	if (Array.isArray(node)) {
		for (const child of node) {
			const result = findActionButton(child, label);
			if (result !== undefined) return result;
		}
		return undefined;
	}
	if (!isValidElement<ElementProps>(node)) return undefined;
	if (node.type === "button" && node.props.children === label) {
		return node.props;
	}
	return findActionButton(node.props.children, label);
};
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

	test("always renders Edit actions that call the supplied row callback", () => {
		const editedRows: Row[] = [];
		const table = ResourceTable({
			rows,
			rowKey: (row) => row.id,
			caption: "Rows",
			columns,
			sortColumn: "id",
			sortDirection: "asc",
			onSort: () => undefined,
			onEdit: (row) => editedRows.push(row),
		});
		const editButton = findActionButton(table, "Edit");

		expect(editButton).toBeDefined();
		editButton?.onClick?.();
		expect(editedRows).toEqual([rows[0]]);
	});
	test("preserves Delete callbacks with optional Edit controls", () => {
		for (const withEdit of [true, false]) {
			const deletedRows: Row[] = [];
			const table = ResourceTable({
				rows,
				rowKey: (row) => row.id,
				caption: "Rows",
				columns,
				sortColumn: "id",
				sortDirection: "asc",
				onSort: () => undefined,
				onEdit: withEdit ? () => undefined : undefined,
				onDelete: (row) => deletedRows.push(row),
			});
			expect(findActionButton(table, "Edit") !== undefined).toBe(withEdit);
			const deleteButton = findActionButton(table, "Delete");
			expect(deleteButton).toBeDefined();
			deleteButton?.onClick?.();
			expect(deletedRows).toEqual([rows[0]]);
		}
	});
});
