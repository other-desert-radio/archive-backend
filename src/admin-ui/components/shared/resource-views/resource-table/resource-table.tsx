import type { ReactNode } from "react";
import styles from "./resource-table.module.css";

export type SortDirection = "asc" | "desc";

export type ResourceTableColumn<Row, ColumnKey extends string> = {
	key: ColumnKey;
	label: string;
	render: (row: Row) => ReactNode;
	compare: (left: Row, right: Row) => number;
};

type ResourceTableProps<Row, ColumnKey extends string> = {
	rows: Row[];
	rowKey: (row: Row) => string | number;
	caption: string;
	columns: ResourceTableColumn<Row, ColumnKey>[];
	sortColumn: ColumnKey;
	sortDirection: SortDirection;
	onSort: (column: ColumnKey) => void;
};

/** Renders a typed, sortable table from resource-specific column definitions. */
export const ResourceTable = <Row, ColumnKey extends string>({
	rows,
	rowKey,
	caption,
	columns,
	sortColumn,
	sortDirection,
	onSort,
}: ResourceTableProps<Row, ColumnKey>) => (
	<div className={styles.wrapper}>
		<table className={styles.table}>
			<caption className={styles.hidden}>{caption}</caption>
			<thead>
				<tr>
					{columns.map((column) => {
						const isActive = sortColumn === column.key;
						return (
							<th
								scope="col"
								key={column.key}
								aria-sort={
									isActive
										? sortDirection === "asc"
											? "ascending"
											: "descending"
										: "none"
								}
							>
								<button
									type="button"
									className={isActive ? styles.activeSort : undefined}
									onClick={() => onSort(column.key)}
								>
									{column.label}{" "}
									{isActive ? (sortDirection === "desc" ? "▼" : "▲") : "▽"}
								</button>
							</th>
						);
					})}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={rowKey(row)}>
						{columns.map((column) => (
							<td key={column.key}>{column.render(row)}</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

/** Returns matching rows using trimmed, case-insensitive substring matching. */
export const filterResourceRows = <Row,>(
	rows: Row[],
	query: string,
	getSearchValue: (row: Row) => string,
): Row[] => {
	const normalizedQuery = query.trim().toLowerCase();
	return normalizedQuery === ""
		? rows
		: rows.filter((row) =>
				getSearchValue(row).toLowerCase().includes(normalizedQuery),
			);
};

/** Returns a sorted copy, retaining stable source order for equal values. */
export const sortResourceRows = <Row, ColumnKey extends string>(
	rows: Row[],
	columns: ResourceTableColumn<Row, ColumnKey>[],
	columnKey: ColumnKey,
	direction: SortDirection,
): Row[] => {
	const column = columns.find(({ key }) => key === columnKey);
	if (column === undefined) return [...rows];
	return [...rows].sort(
		(left, right) =>
			column.compare(left, right) * (direction === "asc" ? 1 : -1),
	);
};

export const getNextSort = <ColumnKey extends string>(
	currentColumn: ColumnKey,
	currentDirection: SortDirection,
	nextColumn: ColumnKey,
): { column: ColumnKey; direction: SortDirection } =>
	nextColumn === currentColumn
		? {
				column: currentColumn,
				direction: currentDirection === "asc" ? "desc" : "asc",
			}
		: { column: nextColumn, direction: "asc" };
