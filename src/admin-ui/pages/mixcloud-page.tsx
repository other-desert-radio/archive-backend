import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MixcloudImportCategory } from "../../utils/mixcloud-import-status.js";
import {
	filterMixcloudImports,
	MixcloudImportQueue,
	type MixcloudSortColumn,
	MixcloudTable,
	MixcloudToolbar,
	mixcloudColumns,
	pendingMixcloudImports,
} from "../components/mixcloud/index.js";
import { MessageModal, ToastModal } from "../components/shared/modal/index.js";
import {
	ResourceView,
	type SortDirection,
	sortResourceRows,
	Tag,
	TagsContainer,
} from "../components/shared/resource-views/index.js";
import { type DJsAdminRow, loadDJs } from "../loaders/djs.js";
import {
	loadMixcloudImportStatus,
	loadMixcloudImports,
	type MixcloudImportAdminRow,
	type MixcloudImportStatus,
	refreshMixcloud,
} from "../loaders/mixcloud-imports.js";
import type { ShowsAdminRow } from "../loaders/shows.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";

import styles from "./mixcloud-page.module.css";

type ImportSession = {
	category: MixcloudImportCategory;
	items: MixcloudImportAdminRow[];
};

export const MixcloudPage = () => {
	const [success, setSuccess] = useState<{
		event: number;
		show: ShowsAdminRow;
	}>();
	const successEvent = useRef(0);
	const [djs, setDJs] = useState<DJsAdminRow[]>([]);
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
	const refreshSuccessLookups = useCallback(() => {
		// Refresh tags after saving so newly created tags use their saved colors.
		void loadDJs()
			.then(setDJs)
			.catch(() => {});
		void loadTags()
			.then(setTags)
			.catch(() => {});
	}, []);
	useEffect(refreshSuccessLookups, [refreshSuccessLookups]);
	const [rows, setRows] = useState<MixcloudImportAdminRow[]>([]);
	const [status, setStatus] = useState<MixcloudImportStatus>();
	const [session, setSession] = useState<ImportSession>();
	const [emptyQueueLabel, setEmptyQueueLabel] = useState<string>();
	const launcherRef = useRef<HTMLElement | undefined>(undefined);
	const importReloadVersion = useRef(0);
	const [importReloadError, setImportReloadError] = useState<string>();
	const [isImportReloading, setIsImportReloading] = useState(false);
	const isImportOpen = session !== undefined || emptyQueueLabel !== undefined;
	const wasImportOpen = useRef(false);
	useEffect(() => {
		if (!isImportOpen && wasImportOpen.current) launcherRef.current?.focus();
		wasImportOpen.current = isImportOpen;
	}, [isImportOpen]);
	const closeImport = () => {
		setSession(undefined);
		setEmptyQueueLabel(undefined);
	};
	const openImport = (category: MixcloudImportCategory) => {
		if (isImportOpen || refreshInFlight.current) return;
		launcherRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: undefined;
		const items = pendingMixcloudImports(rows, category);
		if (items.length === 0) {
			setEmptyQueueLabel(
				category === "auto_parsed" ? "ready for import" : "needs review",
			);
			return;
		}
		setSession({ category, items });
	};
	const [statusError, setStatusError] = useState<string>();
	const loadStatus = useCallback(() => {
		setStatusError(undefined);
		loadMixcloudImportStatus()
			.then(setStatus)
			.catch(() => {
				setStatus(undefined);
				setStatusError("Unable to load Mixcloud import status.");
			});
	}, []);
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
		if (refreshInFlight.current || isImportOpen) return;
		importReloadVersion.current += 1;
		setIsImportReloading(false);
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
			const [newRows, newStatus] = await Promise.all([
				loadMixcloudImports(),
				loadMixcloudImportStatus(),
			]);
			setRows(newRows);
			setStatus(newStatus);
			setStatusError(undefined);
			setRefreshMessage("Mixcloud refreshed.");
		} catch {
			setStatus(undefined);
			setStatusError("Unable to reload Mixcloud import status.");
			setRefreshFailed(true);
			setRefreshMessage(
				"Mixcloud refreshed, but the table or status counts could not be reloaded. Please try again.",
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
		loadStatus();
	}, [refresh, loadStatus]);
	const reloadAfterImport = useCallback(() => {
		const version = ++importReloadVersion.current;
		setIsImportReloading(true);
		setImportReloadError(undefined);
		Promise.all([loadMixcloudImports(), loadMixcloudImportStatus()])
			.then(([newRows, newStatus]) => {
				if (version !== importReloadVersion.current) return;
				setRows(newRows);
				setStatus(newStatus);
				setStatusError(undefined);
			})
			.catch(() => {
				if (version === importReloadVersion.current)
					setImportReloadError(
						"Show imported, but the table or status counts could not be reloaded.",
					);
			})
			.finally(() => {
				if (version === importReloadVersion.current)
					setIsImportReloading(false);
			});
	}, []);
	useEffect(
		() => () => {
			importReloadVersion.current += 1;
		},
		[],
	);
	const onImported = (rowId: number, show: ShowsAdminRow) => {
		setSuccess({ event: ++successEvent.current, show });
		refreshSuccessLookups();
		// Commit is already confirmed. Keep local tracking correct even if reload fails.
		setRows((current) =>
			current.map((row) =>
				row.id === rowId
					? {
							...row,
							show_id: show.id,
							imported_at: new Date().toISOString(),
							data_changed: false,
							show_name: show.title,
							djs: show.djs,
							tags: show.tags,
						}
					: row,
			),
		);
		if (session)
			setStatus((current) =>
				current === undefined
					? current
					: {
							...current,
							[session.category]: Math.max(0, current[session.category] - 1),
						},
			);
		reloadAfterImport();
	};
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
		<>
			<div
				inert={isImportOpen || undefined}
				aria-hidden={isImportOpen || undefined}
			>
				<ResourceView
					title="MIXCLOUD IMPORT"
					isLoading={isLoading}
					error={error}
					onRetry={refresh}
					isEmpty={rows.length === 0}
					emptyMessage="No Mixcloud imports yet."
					hasNoResults={rows.length > 0 && visible.length === 0}
					noResultsMessage="No Mixcloud imports match your filters."
					toolbar={
						<MixcloudToolbar
							query={query}
							onQueryChange={setQuery}
							onRefresh={onRefreshMixcloud}
							isRefreshing={isRefreshing}
							refreshMessage={refreshMessage}
							refreshFailed={refreshFailed}
							status={status}
							isImportOpen={isImportOpen}
							onOpenImport={openImport}
							statusError={statusError}
							onRetryStatus={loadStatus}
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
				{importReloadError !== undefined && (
					<p role="alert">
						{importReloadError}{" "}
						<button
							type="button"
							onClick={reloadAfterImport}
							disabled={isImportReloading}
						>
							Reload import list
						</button>
					</p>
				)}
			</div>
			{success !== undefined && (
				<ToastModal
					key={success.event}
					onDismiss={() => setSuccess(undefined)}
					message={
						<div className={styles.success}>
							<strong>Successfully added show.</strong>
							<div>
								<div>{success.show.title}</div>
								<div>
									{success.show.djs
										.map(
											(id) =>
												djs.find((dj) => dj.id === id)?.title ?? `DJ #${id}`,
										)
										.join(", ")}
								</div>
							</div>
							<TagsContainer label={`${success.show.title} tags`}>
								{success.show.tags.map((id) => {
									const tag = tags.find((item) => item.id === id);
									return (
										<Tag
											key={id}
											{...(tag === undefined ? {} : { color: tag.color })}
										>
											{tag?.title ?? `Tag #${id}`}
										</Tag>
									);
								})}
							</TagsContainer>
						</div>
					}
				/>
			)}
			{session !== undefined && (
				<MixcloudImportQueue
					items={session.items}
					remainingCount={pendingMixcloudImports(rows, session.category).length}
					onClose={closeImport}
					onImported={onImported}
				/>
			)}
			{emptyQueueLabel !== undefined && (
				<MessageModal
					title="No pending imports"
					message={`There are no pending Shows in “${emptyQueueLabel}”.`}
					primaryAction={{ label: "OK", onClick: closeImport }}
					onDismiss={closeImport}
				/>
			)}
		</>
	);
};
