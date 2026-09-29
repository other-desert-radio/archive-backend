import {
	ResourceToolbar,
	type ResourceViewMode,
} from "../../shared/resource-views/index.js";

type DJToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	viewMode: ResourceViewMode;
	onViewModeChange: (viewMode: ResourceViewMode) => void;
	onAddDJ: () => void;
};

/** Configures the shared toolbar for the DJ resource. */
export const DJToolbar = ({
	query,
	onQueryChange,
	viewMode,
	onViewModeChange,
	onAddDJ,
}: DJToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		viewMode={viewMode}
		onViewModeChange={onViewModeChange}
		searchLabel="Search DJs"
		createLabel="+ DJ"
		onCreate={onAddDJ}
	/>
);
