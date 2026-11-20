import {
	CountButton,
	GridSort,
	ResourceToolbar,
	type ResourceViewMode,
} from "../../shared/resource-views/index.js";
import type { ShowSortColumn, SortDirection } from "../table/index.js";

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
				<GridSort<ShowSortColumn>
					label="Sort shows"
					viewMode={viewMode}
					sortColumn={sortColumn}
					sortDirection={sortDirection}
					addedColumn="createdAt"
					titleColumn="title"
					dateColumn="date"
					onSortChange={onSortChange}
				/>
			</>
		}
	/>
);
