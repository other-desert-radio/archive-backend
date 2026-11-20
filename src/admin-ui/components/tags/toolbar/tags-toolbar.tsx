import {
	GridSort,
	ResourceToolbar,
	type ResourceViewMode,
	type SortDirection,
} from "../../shared/resource-views/index.js";
import type { TagSortColumn } from "../table/index.js";

type TagsToolbarProps = {
	sortColumn: TagSortColumn;
	sortDirection: SortDirection;
	onSortChange: (column: TagSortColumn, direction: SortDirection) => void;
	query: string;
	viewMode: ResourceViewMode;
	onViewModeChange: (mode: ResourceViewMode) => void;
	onQueryChange: (query: string) => void;
	onAddTag: () => void;
};

/** Configures the shared toolbar for the Tags resource. */
export const TagsToolbar = ({
	sortColumn,
	sortDirection,
	onSortChange,
	query,
	viewMode,
	onViewModeChange,
	onQueryChange,
	onAddTag,
}: TagsToolbarProps) => (
	<ResourceToolbar
		actionsBeforeView={
			<GridSort<TagSortColumn>
				label="Sort tags"
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
		searchLabel="Search Tags"
		createLabel="+ tag"
		onCreate={onAddTag}
	/>
);
