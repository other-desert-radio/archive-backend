import {
	ResourceToolbar,
	type ResourceViewMode,
} from "../../shared/resource-views/index.js";

type SpecialsToolbarProps = {
	query: string;
	viewMode: ResourceViewMode;
	onViewModeChange: (mode: ResourceViewMode) => void;
	onQueryChange: (query: string) => void;
	onAddSpecial: () => void;
};

/** Configures the shared toolbar for the Specials resource. */
export const SpecialsToolbar = ({
	query,
	viewMode,
	onViewModeChange,
	onQueryChange,
	onAddSpecial,
}: SpecialsToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		viewMode={viewMode}
		onViewModeChange={onViewModeChange}
		searchLabel="Search Specials"
		createLabel="+ special"
		onCreate={onAddSpecial}
	/>
);
