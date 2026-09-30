import { useCallback, useEffect, useMemo, useState } from "react";
import {
	type DJSortColumn,
	DJsTable,
	DJToolbar,
	EditDJModal,
	type EditDJModalValues,
	filterDJs,
	OnboardDJModal,
	renderDJCard,
	type SortDirection,
	sortDJs,
} from "../components/dj/index.js";
import type { ResourceViewMode } from "../components/shared/resource-views/index.js";
import {
	ResourceGrid,
	ResourceView,
} from "../components/shared/resource-views/index.js";
import { createDJ } from "../loaders/create-dj.js";
import { type DJsAdminRow, loadDJs } from "../loaders/djs.js";
import { modifyDJ } from "../loaders/modify-dj.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";
import { userPreferences } from "../user-preferences.js";

export const DJsPage = () => {
	const [djs, setDJs] = useState<DJsAdminRow[]>([]);
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [viewMode, setViewMode] = useState<ResourceViewMode>(() =>
		userPreferences.getResourceViewMode("djs"),
	);
	const [sortColumn, setSortColumn] = useState<DJSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingDJ, setEditingDJ] = useState<DJsAdminRow>();
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();

	const refreshDJs = useCallback(() => {
		setIsLoading(true);
		setError(undefined);

		Promise.all([loadDJs(), loadTags()])
			.then(([loadedDJs, loadedTags]) => {
				setDJs(loadedDJs);
				setTags(loadedTags);
			})
			.catch(() => setError("The DJs could not be loaded."))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		refreshDJs();
	}, [refreshDJs]);

	const visibleDJs = useMemo(
		() => sortDJs(filterDJs(djs, query, tags), sortColumn, sortDirection),
		[djs, query, sortColumn, sortDirection, tags],
	);
	const tagsById = useMemo(
		() => new Map(tags.map((tag) => [tag.id, tag])),
		[tags],
	);
	const handleSort = (column: DJSortColumn) => {
		if (column === sortColumn) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}
		setSortColumn(column);
		setSortDirection("asc");
	};
	const handleCreateDJ = async (request: Parameters<typeof createDJ>[0]) => {
		await createDJ(request);
		refreshDJs();
	};
	const handleViewModeChange = (mode: ResourceViewMode) => {
		userPreferences.setResourceViewMode("djs", mode);
		setViewMode(mode);
	};
	const handleEditDJ = (dj: DJsAdminRow) => setEditingDJ(dj);
	const handleModifyDJ = async (request: Parameters<typeof modifyDJ>[0]) => {
		await modifyDJ(request);
		refreshDJs();
	};
	const editModalDJ = useMemo<EditDJModalValues | undefined>(() => {
		if (editingDJ === undefined) return undefined;
		const directTags = editingDJ.directTags ?? [];
		const directTagIds = new Set(directTags);
		const tagTitle = (tagId: number) =>
			tagsById.get(tagId)?.title ?? `Tag #${tagId}`;
		const tagOption = (tagId: number) => {
			const tag = tagsById.get(tagId);
			return {
				id: tagId,
				title: tag?.title ?? `Tag #${tagId}`,
				color: tag?.color ?? "#fff",
			};
		};
		const image = editingDJ.image_large ?? editingDJ.image_small;

		return {
			id: editingDJ.id,
			title: editingDJ.title,
			bio: editingDJ.bio,
			...(editingDJ.socials === undefined
				? {}
				: { socials: editingDJ.socials }),
			...(editingDJ.showTitle === undefined
				? {}
				: { showTitle: editingDJ.showTitle }),
			...(editingDJ.showDescription === undefined
				? {}
				: { showDescription: editingDJ.showDescription }),
			...(image === undefined ? {} : { image }),
			directTagTitles: directTags.map(tagTitle),
			inheritedTags: editingDJ.tags
				.filter((tagId) => !directTagIds.has(tagId))
				.map(tagOption),
		};
	}, [editingDJ, tagsById]);

	return (
		<div className="dj-page">
			<ResourceView
				title="DJs"
				isLoading={isLoading}
				error={error}
				onRetry={refreshDJs}
				isEmpty={djs.length === 0}
				emptyMessage="No DJs have been added yet."
				hasNoResults={djs.length > 0 && visibleDJs.length === 0}
				noResultsMessage="No DJs match your search."
				toolbar={
					<DJToolbar
						query={query}
						onQueryChange={setQuery}
						viewMode={viewMode}
						onViewModeChange={handleViewModeChange}
						onAddDJ={() => setIsModalOpen(true)}
					/>
				}
			>
				{(() => {
					switch (viewMode) {
						case "grid":
							return (
								<ResourceGrid
									rows={visibleDJs}
									rowKey={(dj) => dj.id}
									renderCard={(dj, key) =>
										renderDJCard(dj, tagsById, key, handleEditDJ)
									}
								/>
							);
						case "table":
							return (
								<DJsTable
									djs={visibleDJs}
									sortColumn={sortColumn}
									sortDirection={sortDirection}
									onSort={handleSort}
									onEdit={handleEditDJ}
								/>
							);
					}
				})()}
			</ResourceView>
			<OnboardDJModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSubmit={handleCreateDJ}
			/>
			<EditDJModal
				isOpen={editingDJ !== undefined}
				dj={editModalDJ}
				onClose={() => setEditingDJ(undefined)}
				onSubmit={handleModifyDJ}
			/>
		</div>
	);
};
