import {
	ResourceToolbar,
	type ResourceViewMode,
} from "../../shared/resource-views/resource-toolbar/resource-toolbar.js";

type ShowsToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	viewMode: ResourceViewMode;
	onViewModeChange: (viewMode: ResourceViewMode) => void;
	onAddShow: () => void;
};

/** Configures the shared toolbar for the read-only Shows resource. */
export const ShowsToolbar = ({
	query,
	onQueryChange,
	viewMode,
	onViewModeChange,
	onAddShow,
}: ShowsToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		viewMode={viewMode}
		onViewModeChange={onViewModeChange}
		searchLabel="Search Shows"
		createLabel="+ show"
		onCreate={onAddShow}
	/>
);
