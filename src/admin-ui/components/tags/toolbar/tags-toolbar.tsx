import { ResourceToolbar } from "../../shared/resource-views/index.js";

type TagsToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	onAddTag: () => void;
};

/** Configures the shared toolbar for the table-only Tags resource. */
export const TagsToolbar = ({
	query,
	onQueryChange,
	onAddTag,
}: TagsToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		showViewControls={false}
		searchLabel="Search Tags"
		createLabel="+ tag"
		onCreate={onAddTag}
	/>
);
