import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	filterMixcloudImports,
	type MixcloudSortColumn,
	MixcloudTable,
	MixcloudToolbar,
	mixcloudColumns,
} from "../components/mixcloud/index.js";
import {
	ResourceView,
	type SortDirection,
	sortResourceRows,
} from "../components/shared/resource-views/index.js";
import {
	loadMixcloudImports,
	type MixcloudImportAdminRow,
	refreshMixcloud,
} from "../loaders/mixcloud-imports.js";
export const MixcloudPage = () => {
	const [rows, setRows] = useState<MixcloudImportAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [sortColumn, setSortColumn] = useState<MixcloudSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();
	const [isRefreshing, setIsRefreshing] = useState(false);
	const refreshInFlight = useRef(false);
	const [refreshMessage, setRefreshMessage] = useState<string>();
	const [refreshFailed, setRefreshFailed] = useState(false);
	const onRefreshMixcloud = async () => {
		if (refreshInFlight.current) return;
		refreshInFlight.current = true;
		setIsRefreshing(true);
		setRefreshMessage(undefined);
		setRefreshFailed(false);
		try {
			await refreshMixcloud();
		} catch (error) {
			setRefreshFailed(true);
			setRefreshMessage(
				error instanceof Error && error.message
					? error.message
					: "Unable to refresh Mixcloud. Check your connection and try again.",
			);
			refreshInFlight.current = false;
			setIsRefreshing(false);
			return;
		}
		try {
			setRows(await loadMixcloudImports());
			setRefreshMessage("Mixcloud refreshed.");
		} catch {
			setRefreshFailed(true);
			setRefreshMessage(
				"Mixcloud refreshed, but the table could not be reloaded. Please try again.",
			);
		} finally {
			refreshInFlight.current = false;
			setIsRefreshing(false);
		}
	};
	const refresh = useCallback(() => {
		setIsLoading(true);
		setError(undefined);
		loadMixcloudImports()
			.then(setRows)
			.catch(() => setError("Unable to load Mixcloud imports"))
			.finally(() => setIsLoading(false));
	}, []);
	useEffect(() => {
		refresh();
	}, [refresh]);
	const visible = useMemo(
		() =>
			sortResourceRows(
				filterMixcloudImports(rows, query),
				mixcloudColumns,
				sortColumn,
				sortDirection,
			),
		[rows, query, sortColumn, sortDirection],
	);
	const onSort = (column: MixcloudSortColumn) => {
		if (column === sortColumn)
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
		else {
			setSortColumn(column);
			setSortDirection("asc");
		}
	};
	return (
		<ResourceView
			title="Mixcloud Import"
			isLoading={isLoading}
			error={error}
			onRetry={refresh}
			isEmpty={rows.length === 0}
			emptyMessage="No Mixcloud imports yet."
			hasNoResults={rows.length > 0 && visible.length === 0}
			noResultsMessage="No Mixcloud imports match your search."
			toolbar={
				<MixcloudToolbar
					query={query}
					onQueryChange={setQuery}
					onRefresh={onRefreshMixcloud}
					isRefreshing={isRefreshing}
					refreshMessage={refreshMessage}
					refreshFailed={refreshFailed}
				/>
			}
		>
			<MixcloudTable
				rows={visible}
				sortColumn={sortColumn}
				sortDirection={sortDirection}
				onSort={onSort}
			/>
		</ResourceView>
	);
};
