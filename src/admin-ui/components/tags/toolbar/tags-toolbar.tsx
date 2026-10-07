import {
	ResourceToolbar,
	type ResourceViewMode,
} from "../../shared/resource-views/index.js";

type TagsToolbarProps = {
	query: string;
	viewMode: ResourceViewMode;
	onViewModeChange: (mode: ResourceViewMode) => void;
	onQueryChange: (query: string) => void;
	onAddTag: () => void;
};

/** Configures the shared toolbar for the Tags resource. */
export const TagsToolbar = ({
	query,
	viewMode,
	onViewModeChange,
	onQueryChange,
	onAddTag,
}: TagsToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		viewMode={viewMode}
		onViewModeChange={onViewModeChange}
		searchLabel="Search Tags"
		createLabel="+ tag"
		onCreate={onAddTag}
	/>
);
