import { useCallback, useEffect, useMemo, useState } from "react";
import type { DJJSON } from "../../json-transformers/index.js";
import { DJToolbar } from "../components/dj-toolbar.js";
import { OnboardDJModal } from "../components/onboard-dj-modal.js";
import { DJsTable } from "../components/tables/djs-table.js";
import {
	type DJSortColumn,
	filterDJs,
	type SortDirection,
	sortDJs,
} from "../components/tables/djs-table-utils.js";
import { createDJ } from "../loaders/create-dj.js";
import { loadDJs } from "../loaders/djs.js";
import { loadTags, type TagsAdminRow } from "../loaders/tags.js";

export const DJsPage = () => {
	const [djs, setDJs] = useState<DJJSON[]>([]);
	const [tags, setTags] = useState<TagsAdminRow[]>([]);
	const [query, setQuery] = useState("");
	const [sortColumn, setSortColumn] = useState<DJSortColumn>("id");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [isModalOpen, setIsModalOpen] = useState(false);
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

	return (
		<div className="dj-page">
			{isLoading && <p className="status">Loading DJs…</p>}
			{error !== undefined && (
				<div className="message error" role="alert">
					<p>The DJs could not be loaded.</p>
					<button type="button" onClick={refreshDJs}>
						Try again
					</button>
				</div>
			)}
			{!isLoading && error === undefined && (
				<>
					<DJToolbar
						query={query}
						onQueryChange={setQuery}
						onAddDJ={() => setIsModalOpen(true)}
					/>
					{djs.length > 0 ? (
						<DJsTable
							djs={visibleDJs}
							sortColumn={sortColumn}
							sortDirection={sortDirection}
							onSort={handleSort}
						/>
					) : (
						<div className="table-wrapper empty-table">
							<p>No DJs have been added yet.</p>
						</div>
					)}
				</>
			)}
			<OnboardDJModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				onSubmit={handleCreateDJ}
			/>
		</div>
	);
};
