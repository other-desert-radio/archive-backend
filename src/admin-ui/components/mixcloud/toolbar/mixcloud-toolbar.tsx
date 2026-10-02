import { ResourceToolbar } from "../../shared/resource-views/index.js";
import styles from "./mixcloud-toolbar.module.css";

type Props = {
	query: string;
	onQueryChange: (query: string) => void;
	onRefresh: () => void;
	isRefreshing: boolean;
	refreshMessage?: string | undefined;
	refreshFailed: boolean;
};
export const MixcloudToolbar = ({
	query,
	onQueryChange,
	onRefresh,
	isRefreshing,
	refreshMessage,
	refreshFailed,
}: Props) => (
	<>
		<ResourceToolbar
			query={query}
			onQueryChange={onQueryChange}
			searchLabel="Search Mixcloud"
			showViewControls={false}
			createLabel={isRefreshing ? "Refreshing Mixcloud…" : "Refresh Mixcloud"}
			onCreate={onRefresh}
			createDisabled={isRefreshing}
		/>
		{refreshMessage && (
			<p className={styles.message} role={refreshFailed ? "alert" : "status"}>
				{refreshMessage}
			</p>
		)}
	</>
);
