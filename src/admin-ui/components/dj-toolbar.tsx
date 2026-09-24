import { ResourceToolbar } from "./resource-toolbar.js";

type DJToolbarProps = {
	query: string;
	onQueryChange: (query: string) => void;
	onAddDJ: () => void;
};

/** Configures the shared toolbar for the DJ resource. */
export const DJToolbar = ({
	query,
	onQueryChange,
	onAddDJ,
}: DJToolbarProps) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		searchLabel="Search DJs"
		createLabel="+ DJ"
		onCreate={onAddDJ}
	/>
);
