import { useCallback, useEffect, useState } from "react";
import { DatabaseTableView } from "../components/database-table-view.js";
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
		<DatabaseTableView
			title="Shows"
			isLoading={isLoading}
			error={error}
			onRetry={refreshShows}
			isEmpty={shows.length === 0}
			emptyMessage="No shows have been added yet."
		>
			<ShowsTable shows={shows} />
		</DatabaseTableView>
	);
};
