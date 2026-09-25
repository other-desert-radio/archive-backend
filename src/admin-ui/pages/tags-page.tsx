import { useCallback, useEffect, useMemo, useState } from "react";
import {
	type SortDirection,
	sortResourceRows,
} from "../components/shared/resource-table.js";
import { ResourceView } from "../components/shared/resource-view.js";
import {
	type TagSortColumn,
	TagsTable,
	tagColumns,
} from "../components/tags/tags-table.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";

export const TagsPage = () => {
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
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
		() => sortResourceRows(tags, tagColumns, sortColumn, sortDirection),
		[tags, sortColumn, sortDirection],
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
		>
			<TagsTable
				tags={visibleTags}
				sortColumn={sortColumn}
				sortDirection={sortDirection}
				onSort={handleSort}
			/>
		</ResourceView>
	);
};
