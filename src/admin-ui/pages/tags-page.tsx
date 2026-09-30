import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ResourceView,
	type SortDirection,
	sortResourceRows,
} from "../components/shared/resource-views/index.js";
import {
	EditTagModal,
	filterTags,
	OnboardTagModal,
	type TagSortColumn,
	TagsTable,
	TagsToolbar,
	tagColumns,
} from "../components/tags/index.js";
import { createTag } from "../loaders/create-tag.js";
import { modifyTag } from "../loaders/modify-tag.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";

export const TagsPage = () => {
	const [isOnboarding, setIsOnboarding] = useState(false);
	const [editingTag, setEditingTag] = useState<TagsAdminRow>();
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
		<>
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
						onAddTag={() => setIsOnboarding(true)}
					/>
				}
			>
				<TagsTable
					tags={visibleTags}
					sortColumn={sortColumn}
					sortDirection={sortDirection}
					onSort={handleSort}
					onEdit={setEditingTag}
					onReviewSave={async (request) => {
						const saved = await modifyTag(request);
						setTags((current) =>
							current.map((tag) =>
								tag.id === saved.id
									? { ...tag, reviewed: saved.reviewed }
									: tag,
							),
						);
					}}
				/>
			</ResourceView>
			{isOnboarding && (
				<OnboardTagModal
					onClose={() => setIsOnboarding(false)}
					onSubmit={async (request) => {
						await createTag(request);
						setQuery("");
						refreshTags();
					}}
				/>
			)}
			{editingTag !== undefined && (
				<EditTagModal
					key={editingTag.id}
					tag={editingTag}
					onClose={() => setEditingTag(undefined)}
					onSubmit={async (request) => {
						await modifyTag(request);
						refreshTags();
					}}
				/>
			)}
		</>
	);
};
