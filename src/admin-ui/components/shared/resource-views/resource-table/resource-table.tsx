import { type ReactNode, useEffect, useRef } from "react";
import toolbarStyles from "../resource-toolbar/resource-toolbar.module.css";
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
	rowAction?:
		| undefined
		| {
				label: string;
				title?: string;
				onClick: (row: Row) => void;
				isVisible: (row: Row) => boolean;
				disabled?: boolean;
		  };
	onEdit?: (row: Row) => void;
	isEditDisabled?: (row: Row) => boolean;
	isDeleteDisabled?: (row: Row) => boolean;
	onDelete?: (row: Row) => void;
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
	rowAction,
	onEdit,
	isEditDisabled,
	isDeleteDisabled,
	onDelete,
}: ResourceTableProps<Row, ColumnKey>) => {
	const wrapperRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const wrapper = wrapperRef.current;
		if (!wrapper) return;
		const toolbar = wrapper
			.closest("section")
			?.querySelector<HTMLElement>(`.${toolbarStyles.toolbar}`);
		const header = wrapper.querySelector("thead");
		if (!header) return;
		// Horizontal overflow prevents CSS sticky from following the page scroll.
		const update = () => {
			const bounds = wrapper.getBoundingClientRect();
			const top = toolbar?.getBoundingClientRect().bottom ?? 0;
			const offset = Math.max(
				0,
				Math.min(top - bounds.top, bounds.height - header.offsetHeight),
			);
			header.style.transform = `translateY(${offset}px)`;
		};
		const observer = new ResizeObserver(update);
		observer.observe(wrapper);
		if (toolbar) observer.observe(toolbar);
		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			observer.disconnect();
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	return (
		<div ref={wrapperRef} className={styles.wrapper}>
			<table className={styles.table}>
				<caption className={styles.hidden}>{caption}</caption>
				<thead>
					<tr>
						{(rowAction !== undefined ||
							onEdit !== undefined ||
							onDelete !== undefined) && (
							<th scope="col" className={styles.actionHeader}>
								Actions
							</th>
						)}
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
							{(rowAction !== undefined ||
								onEdit !== undefined ||
								onDelete !== undefined) && (
								<td className={styles.actionCell}>
									{rowAction?.isVisible(row) && (
										<button
											type="button"
											className={styles.editButton}
											disabled={rowAction.disabled}
											title={rowAction.title}
											onClick={() => rowAction.onClick(row)}
										>
											{rowAction.label}
										</button>
									)}
									{onEdit && (
										<button
											type="button"
											className={styles.editButton}
											disabled={isEditDisabled?.(row)}
											onClick={() => onEdit(row)}
										>
											Edit
										</button>
									)}
									{onDelete && (
										<button
											type="button"
											className={styles.deleteButton}
											disabled={isDeleteDisabled?.(row)}
											onClick={() => onDelete(row)}
										>
											Delete
										</button>
									)}
								</td>
							)}
							{columns.map((column) => (
								<td key={column.key}>{column.render(row)}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
};

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
