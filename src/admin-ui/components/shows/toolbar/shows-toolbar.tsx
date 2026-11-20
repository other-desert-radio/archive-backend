import {
	CountButton,
	ResourceToolbar,
	type ResourceViewMode,
} from "../../shared/resource-views/index.js";
import type { ShowSortColumn, SortDirection } from "../table/index.js";

import styles from "./shows-toolbar.module.css";

const sortOptions = [
	{ column: "createdAt", direction: "asc", label: "added ↑" },
	{ column: "createdAt", direction: "desc", label: "added ↓" },
	{ column: "date", direction: "asc", label: "show date ↑" },
	{ column: "date", direction: "desc", label: "show date ↓" },
	{ column: "title", direction: "asc", label: "A–Z" },
	{ column: "title", direction: "desc", label: "Z–A" },
] as const;

type ShowsToolbarProps = {
	sortColumn: ShowSortColumn;
	sortDirection: SortDirection;
	onSortChange: (column: ShowSortColumn, direction: SortDirection) => void;
	query: string;
	onQueryChange: (query: string) => void;
	viewMode: ResourceViewMode;
	onViewModeChange: (viewMode: ResourceViewMode) => void;
	onAddShow: () => void;
	pendingCount: number | undefined;
	onPendingUploads: () => void;
};

/** Configures the shared toolbar for the read-only Shows resource. */
export const ShowsToolbar = ({
	sortColumn,
	sortDirection,
	onSortChange,
	query,
	onQueryChange,
	viewMode,
	onViewModeChange,
	onAddShow,
	pendingCount,
	onPendingUploads,
}: ShowsToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		viewMode={viewMode}
		onViewModeChange={onViewModeChange}
		searchLabel="Search Shows"
		createLabel="+ show"
		onCreate={onAddShow}
		actionsBeforeView={
			<>
				{pendingCount !== undefined && pendingCount > 0 && (
					<CountButton
						label="pending uploads"
						count={pendingCount}
						title="Resume uploaded shows that have not been saved to the archive."
						onClick={onPendingUploads}
					/>
				)}
				{viewMode === "grid" && (
					<span className={styles.sortControl}>
						<select
							className={styles.sort}
							aria-label="Sort shows"
							value={`${sortColumn}:${sortDirection}`}
							onChange={(event) => {
								const option = sortOptions.find(
									(option) =>
										`${option.column}:${option.direction}` ===
										event.target.value,
								);
								if (option) onSortChange(option.column, option.direction);
							}}
						>
							{!sortOptions.some(
								(option) =>
									option.column === sortColumn &&
									option.direction === sortDirection,
							) && (
								<option value={`${sortColumn}:${sortDirection}`} disabled>
									table sort
								</option>
							)}
							{sortOptions.map((option) => (
								<option
									key={`${option.column}:${option.direction}`}
									value={`${option.column}:${option.direction}`}
								>
									{option.label}
								</option>
							))}
						</select>
					</span>
				)}
			</>
		}
	/>
);
