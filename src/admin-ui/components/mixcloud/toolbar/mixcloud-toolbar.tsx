import { ResourceToolbar } from "../../shared/resource-views/index.js";

type Props = { query: string; onQueryChange: (query: string) => void };
export const MixcloudToolbar = ({ query, onQueryChange }: Props) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		searchLabel="Search Mixcloud"
		showViewControls={false}
		createLabel="Refresh Mixcloud"
		onCreate={() => {
			// Button-only review: connect the refresh route in a later chunk.
		}}
	/>
);
