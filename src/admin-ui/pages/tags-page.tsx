import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ResourceGrid,
	ResourceView,
	type ResourceViewMode,
	type SortDirection,
	sortResourceRows,
} from "../components/shared/resource-views/index.js";
import {
	DeleteTagModal,
	EditTagModal,
	filterTags,
	OnboardTagModal,
	renderTagCard,
	type TagSortColumn,
	TagsTable,
	TagsToolbar,
	tagColumns,
} from "../components/tags/index.js";
import { createTag } from "../loaders/create-tag.js";
import { modifyTag } from "../loaders/modify-tag.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";
import { userPreferences } from "../user-preferences.js";

export const TagsPage = () => {
	const [deletingTag, setDeletingTag] = useState<TagsAdminRow>();
	const viewRef = useRef<HTMLDivElement>(null);
	const [isOnboarding, setIsOnboarding] = useState(false);
	const [editingTag, setEditingTag] = useState<TagsAdminRow>();
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [viewMode, setViewMode] = useState<ResourceViewMode>(() =>
		userPreferences.getResourceViewMode("tags"),
	);
	const handleViewModeChange = (mode: ResourceViewMode) => {
		userPreferences.setResourceViewMode("tags", mode);
		setViewMode(mode);
	};
	const handleColorSave = async (tag: TagsAdminRow, color: string) => {
		const saved = await modifyTag({
			edit_type: "partial_edit",
			id: tag.id,
			color,
		});
		setTags((current) =>
			current.map((row) => (row.id === saved.id ? saved : row)),
		);
	};
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
			<div ref={viewRef} inert={deletingTag !== undefined}>
				<ResourceView
					title="TAGS"
					isLoading={isLoading}
					error={error}
					onRetry={refreshTags}
					isEmpty={tags.length === 0}
					emptyMessage="No tags have been added yet."
					hasNoResults={tags.length > 0 && visibleTags.length === 0}
					noResultsMessage="No tags match your search."
					toolbar={
						<TagsToolbar
							viewMode={viewMode}
							onViewModeChange={handleViewModeChange}
							query={query}
							onQueryChange={setQuery}
							onAddTag={() => setIsOnboarding(true)}
						/>
					}
				>
					{viewMode === "grid" ? (
						<ResourceGrid
							rows={visibleTags}
							rowKey={(tag) => tag.id}
							minimumColumnWidth="32rem"
							renderCard={(tag, key) =>
								renderTagCard(tag, key, setEditingTag, handleColorSave)
							}
						/>
					) : (
						<TagsTable
							tags={visibleTags}
							sortColumn={sortColumn}
							sortDirection={sortDirection}
							onSort={handleSort}
							onEdit={setEditingTag}
							onDelete={setDeletingTag}
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
					)}
				</ResourceView>
			</div>
			{deletingTag !== undefined && (
				<DeleteTagModal
					key={deletingTag.id}
					tag={deletingTag}
					onClose={() => setDeletingTag(undefined)}
					onDeleted={(id) => {
						setTags((current) => current.filter((tag) => tag.id !== id));
						setDeletingTag(undefined);
						window.requestAnimationFrame(() =>
							viewRef.current
								?.querySelector<HTMLElement>(
									'input[aria-label="Search Tags"], button',
								)
								?.focus(),
						);
					}}
				/>
			)}
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
