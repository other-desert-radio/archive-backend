import {
	GridSort,
	ResourceToolbar,
	type ResourceViewMode,
	type SortDirection,
} from "../../shared/resource-views/index.js";
import type { SpecialSortColumn } from "../table/index.js";

type SpecialsToolbarProps = {
	sortColumn: SpecialSortColumn;
	sortDirection: SortDirection;
	onSortChange: (column: SpecialSortColumn, direction: SortDirection) => void;
	query: string;
	viewMode: ResourceViewMode;
	onViewModeChange: (mode: ResourceViewMode) => void;
	onQueryChange: (query: string) => void;
	onAddSpecial: () => void;
};

/** Configures the shared toolbar for the Specials resource. */
export const SpecialsToolbar = ({
	sortColumn,
	sortDirection,
	onSortChange,
	query,
	viewMode,
	onViewModeChange,
	onQueryChange,
	onAddSpecial,
}: SpecialsToolbarProps) => (
	<ResourceToolbar
		actionsBeforeView={
			<GridSort<SpecialSortColumn>
				label="Sort specials"
				viewMode={viewMode}
				sortColumn={sortColumn}
				sortDirection={sortDirection}
				addedColumn="id"
				titleColumn="title"
				onSortChange={onSortChange}
			/>
		}
		query={query}
		onQueryChange={onQueryChange}
		viewMode={viewMode}
		onViewModeChange={onViewModeChange}
		searchLabel="Search Specials"
		createLabel="+ special"
		onCreate={onAddSpecial}
	/>
);
