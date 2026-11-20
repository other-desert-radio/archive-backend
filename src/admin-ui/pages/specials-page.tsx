import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ToastModal } from "../components/shared/modal/index.js";
import {
	ResourceGrid,
	ResourceView,
	type ResourceViewMode,
	type SortDirection,
	sortResourceRows,
} from "../components/shared/resource-views/index.js";
import {
	DeleteSpecialModal,
	filterSpecials,
	OnboardSpecialModal,
	SpecialCard,
	type SpecialSortColumn,
	SpecialsTable,
	SpecialsToolbar,
	specialColumns,
} from "../components/specials/index.js";
import { createSpecial } from "../loaders/create-special.js";
import { modifySpecial } from "../loaders/modify-special.js";
import { loadShows, type ShowsAdminRow } from "../loaders/shows.js";
import { loadSpecials, type SpecialsAdminRow } from "../loaders/specials.js";
import { userPreferences } from "../user-preferences.js";

export const SpecialsPage = () => {
	const [editingSpecial, setEditingSpecial] = useState<SpecialsAdminRow>();
	const [deletingSpecial, setDeletingSpecial] = useState<SpecialsAdminRow>();
	const viewRef = useRef<HTMLDivElement>(null);
	const [isOnboarding, setIsOnboarding] = useState(false);
	const [deletedSpecial, setDeletedSpecial] = useState<SpecialsAdminRow>();
	const [specials, setSpecials] = useState<SpecialsAdminRow[]>([]);
	const [shows, setShows] = useState<ShowsAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [viewMode, setViewMode] = useState<ResourceViewMode>(() =>
		userPreferences.getResourceViewMode("specials"),
	);
	const handleViewModeChange = (mode: ResourceViewMode) => {
		userPreferences.setResourceViewMode("specials", mode);
		setViewMode(mode);
	};
	const [sortColumn, setSortColumn] = useState<SpecialSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();

	const refreshSpecials = useCallback(() => {
		setIsLoading(true);
		setError(undefined);

		Promise.all([loadSpecials(), loadShows()])
			.then(([loadedSpecials, loadedShows]) => {
				setSpecials(loadedSpecials);
				setShows(loadedShows);
			})
			.catch(() => setError("The specials could not be loaded."))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		refreshSpecials();
	}, [refreshSpecials]);

	const visibleSpecials = useMemo(
		() =>
			sortResourceRows(
				filterSpecials(
					specials.map((special) => ({
						...special,
						showTitles: shows
							.filter((show) => show.special?.id === special.id)
							.sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id)
							.map((show) => show.title),
					})),
					query,
				),
				specialColumns,
				sortColumn,
				sortDirection,
			),
		[specials, shows, query, sortColumn, sortDirection],
	);
	const handleSort = (column: SpecialSortColumn) => {
		if (column === sortColumn) {
			setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
			return;
		}
		setSortColumn(column);
		setSortDirection("asc");
	};

	return (
		<>
			<div
				ref={viewRef}
				inert={
					deletingSpecial !== undefined ||
					editingSpecial !== undefined ||
					isOnboarding
				}
			>
				<ResourceView
					title="SPECIALS"
					isLoading={isLoading}
					error={error}
					onRetry={refreshSpecials}
					isEmpty={specials.length === 0}
					emptyMessage="No specials have been added yet."
					hasNoResults={specials.length > 0 && visibleSpecials.length === 0}
					noResultsMessage="No specials match your search."
					toolbar={
						<SpecialsToolbar
							sortColumn={sortColumn}
							sortDirection={sortDirection}
							onSortChange={(column, direction) => {
								setSortColumn(column);
								setSortDirection(direction);
							}}
							viewMode={viewMode}
							onViewModeChange={handleViewModeChange}
							query={query}
							onQueryChange={setQuery}
							onAddSpecial={() => setIsOnboarding(true)}
						/>
					}
				>
					{viewMode === "grid" ? (
						<ResourceGrid
							rows={visibleSpecials}
							rowKey={(special) => special.id}
							minimumColumnWidthRem={32}
							renderCard={(special, key) => (
								<SpecialCard
									key={key}
									special={special}
									onEdit={setEditingSpecial}
									onDelete={setDeletingSpecial}
								/>
							)}
						/>
					) : (
						<SpecialsTable
							specials={visibleSpecials}
							sortColumn={sortColumn}
							sortDirection={sortDirection}
							onSort={handleSort}
							onEdit={setEditingSpecial}
							onDelete={setDeletingSpecial}
						/>
					)}
				</ResourceView>
			</div>
			{deletingSpecial !== undefined && (
				<DeleteSpecialModal
					key={deletingSpecial.id}
					special={deletingSpecial}
					onClose={() => setDeletingSpecial(undefined)}
					onDeleted={(id) => {
						setSpecials((current) =>
							current.filter((special) => special.id !== id),
						);
						setDeletedSpecial(deletingSpecial);
						setDeletingSpecial(undefined);
						window.requestAnimationFrame(() =>
							viewRef.current
								?.querySelector<HTMLElement>(
									'input[aria-label="Search Specials"], button',
								)
								?.focus(),
						);
					}}
				/>
			)}
			{editingSpecial && (
				<OnboardSpecialModal
					special={editingSpecial}
					onClose={() => setEditingSpecial(undefined)}
					onSubmit={async (request) => {
						const saved = await modifySpecial({
							...request,
							id: editingSpecial.id,
						});
						setSpecials((current) =>
							current.map((special) =>
								special.id === saved.id ? saved : special,
							),
						);
					}}
				/>
			)}
			{isOnboarding && (
				<OnboardSpecialModal
					onClose={() => setIsOnboarding(false)}
					onSubmit={async (request) => {
						const saved = await createSpecial(request);
						setSpecials((current) => [...current, saved]);
						setQuery("");
						refreshSpecials();
					}}
				/>
			)}
			{deletedSpecial && (
				<ToastModal
					key={deletedSpecial.id}
					message={`Deleted “${deletedSpecial.title}”.`}
					onDismiss={() => setDeletedSpecial(undefined)}
				/>
			)}
		</>
	);
};
