import { ResourceToolbar } from "../shared/resource-toolbar.js";

type ShowsToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
};

/** Configures the shared toolbar for the read-only Shows resource. */
export const ShowsToolbar = ({ query, onQueryChange }: ShowsToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		searchLabel="Search Shows"
		createLabel="+ Show"
		onCreate={() => undefined}
		createDisabled
	/>
);
