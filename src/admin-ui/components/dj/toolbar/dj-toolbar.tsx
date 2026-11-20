import {
	GridSort,
	ResourceToolbar,
	type ResourceViewMode,
	type SortDirection,
} from "../../shared/resource-views/index.js";
import type { DJSortColumn } from "../table/index.js";

type DJToolbarProps = {
	sortColumn: DJSortColumn;
	sortDirection: SortDirection;
	onSortChange: (column: DJSortColumn, direction: SortDirection) => void;
	query: string;
	onQueryChange: (query: string) => void;
	viewMode: ResourceViewMode;
	onViewModeChange: (viewMode: ResourceViewMode) => void;
	onAddDJ: () => void;
};

/** Configures the shared toolbar for the DJ resource. */
export const DJToolbar = ({
	sortColumn,
	sortDirection,
	onSortChange,
	query,
	onQueryChange,
	viewMode,
	onViewModeChange,
	onAddDJ,
}: DJToolbarProps) => (
	<ResourceToolbar
		actionsBeforeView={
			<GridSort<DJSortColumn>
				label="Sort DJs"
				viewMode={viewMode}
				sortColumn={sortColumn}
				sortDirection={sortDirection}
				addedColumn="createdAt"
				titleColumn="title"
				onSortChange={onSortChange}
			/>
		}
		query={query}
		onQueryChange={onQueryChange}
		viewMode={viewMode}
		onViewModeChange={onViewModeChange}
		searchLabel="Search DJs"
		createLabel="+ DJ"
		onCreate={onAddDJ}
	/>
);
