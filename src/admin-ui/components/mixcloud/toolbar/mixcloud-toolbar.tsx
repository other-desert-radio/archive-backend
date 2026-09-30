import { ResourceToolbar } from "../../shared/resource-views/index.js";

type Props = { query: string; onQueryChange: (query: string) => void };
export const MixcloudToolbar = ({ query, onQueryChange }: Props) => (
	<ResourceToolbar
		query={query}
		onQueryChange={onQueryChange}
		searchLabel="Search Mixcloud"
		showViewControls={false}
	/>
);
