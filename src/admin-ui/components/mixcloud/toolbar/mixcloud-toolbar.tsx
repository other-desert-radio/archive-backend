import type { MixcloudImportCategory } from "../../../../utils/mixcloud-import-status.js";
import type { MixcloudImportStatus } from "../../../loaders/mixcloud-imports.js";
import { ResourceToolbar } from "../../shared/resource-views/index.js";
import styles from "./mixcloud-toolbar.module.css";

type Props = {
	query: string;
	onQueryChange: (query: string) => void;
	onRefresh: () => void;
	isRefreshing: boolean;
	refreshMessage?: string | undefined;
	refreshFailed: boolean;
	status?: MixcloudImportStatus | undefined;
	isImportOpen?: boolean;
	onOpenImport?: (category: MixcloudImportCategory) => void;
	statusError?: string | undefined;
	onRetryStatus?: () => void;
};
export const MixcloudToolbar = ({
	query,
	onQueryChange,
	onRefresh,
	isRefreshing,
	refreshMessage,
	refreshFailed,
	status,
	isImportOpen = false,
	onOpenImport,
	statusError,
	onRetryStatus,
}: Props) => (
	<>
		<ResourceToolbar
			query={query}
			onQueryChange={onQueryChange}
			searchLabel="Search Mixcloud"
			showViewControls={false}
			createLabel={isRefreshing ? "Refreshing Mixcloud…" : "Refresh Mixcloud"}
			onCreate={onRefresh}
			createDisabled={isRefreshing || isImportOpen}
			actionsBeforeCreate={(
				[
					["auto_parsed", "ready for import"],
					["unparsable", "needs review"],
				] as const
			).map(([value, label]) => (
				<button
					key={value}
					type="button"
					className={styles.category}
					aria-haspopup="dialog"
					disabled={!status || isRefreshing || isImportOpen}
					onClick={() => onOpenImport?.(value)}
				>
					{label}
					{status && status[value] > 0 && (
						<span className={styles.count}>{status[value]}</span>
					)}
				</button>
			))}
		/>
		{statusError && (
			<p role="alert">
				{statusError}{" "}
				<button type="button" onClick={onRetryStatus}>
					Try again
				</button>
			</p>
		)}
		{refreshMessage && (
			<p className={styles.message} role={refreshFailed ? "alert" : "status"}>
				{refreshMessage}
			</p>
		)}
	</>
);
