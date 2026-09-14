import { useCallback, useEffect, useState } from "react";
import type { DJsJSON } from "../../json-transformers/index.js";
import {
	Body,
	DatabaseTableView,
	Header,
} from "../components/database-table-view.js";
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
		<DatabaseTableView>
			<Header title="DJs" />
			<Body>
				{isLoading && <p className="status">Loading DJs…</p>}

				{error && (
					<div className="message error" role="alert">
						<p>{error}</p>
						<button type="button" onClick={refreshDJs}>
							Try again
						</button>
					</div>
				)}

				{!isLoading && !error && djs.length === 0 && (
					<p className="status">No DJs have been added yet.</p>
				)}

				{!isLoading && !error && djs.length > 0 && (
					<div className="table-wrapper">
						<table>
							<thead>
								<tr>
									<th scope="col">ID</th>
									<th scope="col">DJ</th>
									<th scope="col">Bio</th>
									<th scope="col">Image</th>
								</tr>
							</thead>
							<tbody>
								{djs.map((dj) => (
									<tr key={dj.id}>
										<td>{dj.id}</td>
										<td>{dj.title}</td>
										<td>{dj.bio}</td>
										<td>
											{dj.image ? (
												<img src={dj.image} alt={`${dj.title} portrait`} />
											) : (
												<span className="muted">None</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Body>
		</DatabaseTableView>
	);
};
