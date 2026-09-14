import { useCallback, useEffect, useState } from "react";
import {
	Body,
	DatabaseTableView,
	Header,
} from "../components/database-table-view.js";
import { ShowsTable } from "../components/tables/shows-table.js";
import { loadShows, type ShowsAdminRow } from "../loaders/shows.js";

export const ShowsPage = () => {
	const [shows, setShows] = useState<ShowsAdminRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();

	const refreshShows = useCallback(() => {
		setIsLoading(true);
		setError(undefined);

		loadShows()
			.then(setShows)
			.catch(() => setError("The shows could not be loaded."))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		refreshShows();
	}, [refreshShows]);

	return (
		<DatabaseTableView>
			<Header title="Shows" />
			<Body>
				{isLoading && <p className="status">Loading shows…</p>}
				{error && (
					<div className="message error" role="alert">
						<p>{error}</p>
						<button type="button" onClick={refreshShows}>
							Try again
						</button>
					</div>
				)}
				{!isLoading && !error && shows.length === 0 && (
					<p className="status">No shows have been added yet.</p>
				)}
				{!isLoading && !error && shows.length > 0 && (
					<ShowsTable shows={shows} />
				)}
			</Body>
		</DatabaseTableView>
	);
};
