import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResourceViewMode } from "../components/shared/resource-views/index.js";
import {
	ResourceGrid,
	ResourceView,
} from "../components/shared/resource-views/index.js";
import {
	filterShows,
	OnboardShowModal,
	renderShowCard,
	type ShowSortColumn,
	ShowsTable,
	ShowsToolbar,
	type SortDirection,
	sortShows,
} from "../components/shows/index.js";
import { createShow } from "../loaders/create-show.js";
import { type DJsAdminRow, loadDJs } from "../loaders/djs.js";
import { loadShows, type ShowsAdminRow } from "../loaders/shows.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";
import { userPreferences } from "../user-preferences.js";

export const ShowsPage = () => {
	const [shows, setShows] = useState<ShowsAdminRow[]>([]);
	const [djs, setDJs] = useState<DJsAdminRow[]>([]);
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [viewMode, setViewMode] = useState<ResourceViewMode>(() =>
		userPreferences.getResourceViewMode("shows"),
	);
	const [sortColumn, setSortColumn] = useState<ShowSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();
	const [isDJsLoading, setIsDJsLoading] = useState(false);
	const [djsError, setDJsError] = useState<string>();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const loadVersion = useRef(0);

	const refreshShows = useCallback(() => {
		const version = ++loadVersion.current;
		setIsLoading(true);
		setError(undefined);

		Promise.all([loadShows(), loadDJs(), loadTags()])
			.then(([loadedShows, loadedDJs, loadedTags]) => {
				if (version !== loadVersion.current) return;
				setShows(loadedShows);
				setDJs(loadedDJs);
				setTags(loadedTags);
			})
			.catch(() => {
				if (version === loadVersion.current) {
					setError("The shows could not be loaded.");
				}
			})
			.finally(() => {
				if (version === loadVersion.current) setIsLoading(false);
			});
	}, []);
	const refreshDJs = useCallback(() => {
		setIsDJsLoading(true);
		setDJsError(undefined);
		loadDJs()
			.then(setDJs)
			.catch(() => setDJsError("DJs could not be loaded."))
			.finally(() => setIsDJsLoading(false));
	}, []);

	useEffect(() => {
		refreshShows();
		return () => {
			loadVersion.current += 1;
		};
	}, [refreshShows]);

	const djTitlesById = useMemo(
		() => new Map(djs.map((dj) => [dj.id, dj.title])),
		[djs],
	);
	const djsById = useMemo(() => new Map(djs.map((dj) => [dj.id, dj])), [djs]);
	const tagTitlesById = useMemo(
		() => new Map(tags.map((tag) => [tag.id, tag.title])),
		[tags],
	);
	const tagsById = useMemo(
		() => new Map(tags.map((tag) => [tag.id, tag])),
		[tags],
	);
	const visibleShows = useMemo(
		() =>
			sortShows(
				filterShows(shows, query, djTitlesById, tagTitlesById),
				sortColumn,
				sortDirection,
			),
		[shows, query, djTitlesById, tagTitlesById, sortColumn, sortDirection],
	);
	const handleSort = (column: ShowSortColumn) => {
		if (column === sortColumn) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}
		setSortColumn(column);
		setSortDirection("asc");
	};
	const handleCreateShow = async (
		request: Parameters<typeof createShow>[0],
	) => {
		await createShow(request);
		refreshShows();
	};
	const handleViewModeChange = (mode: ResourceViewMode) => {
		userPreferences.setResourceViewMode("shows", mode);
		setViewMode(mode);
	};

	return (
		<>
			<ResourceView
				title="Shows"
				isLoading={isLoading}
				error={error}
				onRetry={refreshShows}
				isEmpty={shows.length === 0}
				emptyMessage="No shows have been added yet."
				hasNoResults={shows.length > 0 && visibleShows.length === 0}
				noResultsMessage="No Shows match your search."
				toolbar={
					<ShowsToolbar
						query={query}
						onQueryChange={setQuery}
						viewMode={viewMode}
						onViewModeChange={handleViewModeChange}
						onAddShow={() => setIsModalOpen(true)}
					/>
				}
			>
				{(() => {
					switch (viewMode) {
						case "grid":
							return (
								<ResourceGrid
									rows={visibleShows}
									rowKey={(show) => show.id}
									renderCard={(show, key) =>
										renderShowCard(show, tagsById, djsById, key)
									}
								/>
							);
						case "table":
							return (
								<ShowsTable
									shows={visibleShows}
									sortColumn={sortColumn}
									sortDirection={sortDirection}
									onSort={handleSort}
								/>
							);
					}
				})()}
			</ResourceView>
			<OnboardShowModal
				isOpen={isModalOpen}
				djs={djs}
				isDJsLoading={isDJsLoading}
				{...(djsError === undefined ? {} : { djsError })}
				onRetryDJs={refreshDJs}
				onClose={() => setIsModalOpen(false)}
				onSubmit={handleCreateShow}
			/>
		</>
	);
};
