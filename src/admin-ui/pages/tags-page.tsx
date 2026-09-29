import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ResourceView,
	type SortDirection,
	sortResourceRows,
} from "../components/shared/resource-views/index.js";
import {
	type TagSortColumn,
	TagsTable,
	tagColumns,
} from "../components/tags/tags-table.js";
import { filterTags } from "../components/tags/tags-table-utils.js";
import { TagsToolbar } from "../components/tags/toolbar/index.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";

const handleEditTag = (_tag: TagsAdminRow) => undefined;
const handleAddTag = () => undefined;

export const TagsPage = () => {
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [sortColumn, setSortColumn] = useState<TagSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();

	const refreshTags = useCallback(() => {
		setIsLoading(true);
		setError(undefined);

		loadTags()
			.then(setTags)
			.catch(() => setError("The tags could not be loaded."))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		refreshTags();
	}, [refreshTags]);

	const visibleTags = useMemo(
		() =>
			sortResourceRows(
				filterTags(tags, query),
				tagColumns,
				sortColumn,
				sortDirection,
			),
		[tags, query, sortColumn, sortDirection],
	);
	const handleSort = (column: TagSortColumn) => {
		if (column === sortColumn) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}
		setSortColumn(column);
		setSortDirection("asc");
	};

	return (
		<ResourceView
			title="Tags"
			isLoading={isLoading}
			error={error}
			onRetry={refreshTags}
			isEmpty={tags.length === 0}
			emptyMessage="No tags have been added yet."
			hasNoResults={tags.length > 0 && visibleTags.length === 0}
			noResultsMessage="No tags match your search."
			toolbar={
				<TagsToolbar
					query={query}
					onQueryChange={setQuery}
					onAddTag={handleAddTag}
				/>
			}
		>
			<TagsTable
				tags={visibleTags}
				sortColumn={sortColumn}
				sortDirection={sortDirection}
				onSort={handleSort}
				onEdit={handleEditTag}
			/>
		</ResourceView>
	);
};
