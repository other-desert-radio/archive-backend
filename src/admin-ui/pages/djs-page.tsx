import { useCallback, useEffect, useState } from "react";
import type { DJsJSON } from "../../json-transformers/index.js";
import { DatabaseTableView } from "../components/database-table-view.js";
import { DJsTable } from "../components/tables/djs-table.js";
import { loadDJs } from "../loaders/djs.js";

export const DJsPage = () => {
	const [djs, setDJs] = useState<DJsJSON[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string>();

	const refreshDJs = useCallback(() => {
		setIsLoading(true);
		setError(undefined);

		loadDJs()
			.then(setDJs)
			.catch(() => setError("The DJs could not be loaded."))
			.finally(() => setIsLoading(false));
	}, []);

	useEffect(() => {
		refreshDJs();
	}, [refreshDJs]);

	return (
		<DatabaseTableView
			title="DJs"
			isLoading={isLoading}
			error={error}
			onRetry={refreshDJs}
			isEmpty={djs.length === 0}
			emptyMessage="No DJs have been added yet."
		>
			<DJsTable djs={djs} />
		</DatabaseTableView>
	);
};
