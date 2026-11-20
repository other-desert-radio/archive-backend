import type { SortDirection } from "../resource-table/index.js";
import type { ResourceViewMode } from "../resource-toolbar/index.js";
import styles from "./grid-sort.module.css";

type GridSortProps<Column extends string> = {
	label: string;
	viewMode: ResourceViewMode;
	sortColumn: Column;
	sortDirection: SortDirection;
	addedColumn: Column;
	titleColumn: Column;
	dateColumn?: Column;
	onSortChange: (column: Column, direction: SortDirection) => void;
};

export const GridSort = <Column extends string>({
	label,
	viewMode,
	sortColumn,
	sortDirection,
	addedColumn,
	titleColumn,
	dateColumn,
	onSortChange,
}: GridSortProps<Column>) => {
	if (viewMode !== "grid") return null;
	const options: { column: Column; direction: SortDirection; label: string }[] =
		[
			{ column: addedColumn, direction: "asc", label: "added ↑" },
			{ column: addedColumn, direction: "desc", label: "added ↓" },
			...(dateColumn === undefined
				? []
				: [
						{
							column: dateColumn,
							direction: "asc" as const,
							label: "show date ↑",
						},
						{
							column: dateColumn,
							direction: "desc" as const,
							label: "show date ↓",
						},
					]),
			{ column: titleColumn, direction: "asc", label: "A–Z" },
			{ column: titleColumn, direction: "desc", label: "Z–A" },
		];
	return (
		<span className={styles.sortControl}>
			<select
				className={styles.sort}
				aria-label={label}
				value={`${sortColumn}:${sortDirection}`}
				onChange={(event) => {
					const option = options.find(
						(option) =>
							`${option.column}:${option.direction}` === event.target.value,
					);
					if (option) onSortChange(option.column, option.direction);
				}}
			>
				{!options.some(
					(option) =>
						option.column === sortColumn && option.direction === sortDirection,
				) && (
					<option value={`${sortColumn}:${sortDirection}`} disabled>
						table sort
					</option>
				)}
				{options.map((option) => (
					<option
						key={`${option.column}:${option.direction}`}
						value={`${option.column}:${option.direction}`}
					>
						{option.label}
					</option>
				))}
			</select>
		</span>
	);
};
