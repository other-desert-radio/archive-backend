import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResourceView } from "../components/shared/resource-view.js";
import { ShowsTable } from "../components/shows/shows-table.js";
import {
	filterShows,
	type ShowSortColumn,
	type SortDirection,
	sortShows,
} from "../components/shows/shows-table-utils.js";
import { ShowsToolbar } from "../components/shows/shows-toolbar.js";
import { type DJsAdminRow, loadDJs } from "../loaders/djs.js";
import { loadShows, type ShowsAdminRow } from "../loaders/shows.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";

export const ShowsPage = () => {
	const [shows, setShows] = useState<ShowsAdminRow[]>([]);
	const [djs, setDJs] = useState<DJsAdminRow[]>([]);
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [sortColumn, setSortColumn] = useState<ShowSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();
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
	const tagTitlesById = useMemo(
		() => new Map(tags.map((tag) => [tag.id, tag.title])),
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

	return (
		<ResourceView
			title="Shows"
			isLoading={isLoading}
			error={error}
			onRetry={refreshShows}
			isEmpty={shows.length === 0}
			emptyMessage="No shows have been added yet."
			hasNoResults={shows.length > 0 && visibleShows.length === 0}
			noResultsMessage="No Shows match your search."
			toolbar={<ShowsToolbar query={query} onQueryChange={setQuery} />}
		>
			<ShowsTable
				shows={visibleShows}
				sortColumn={sortColumn}
				sortDirection={sortDirection}
				onSort={handleSort}
			/>
		</ResourceView>
	);
};
