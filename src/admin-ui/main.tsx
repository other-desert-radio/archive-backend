import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { DJsJson } from "../json-transformers/index.js";
import { loadDJs } from "./djs.js";
import "./styles.css";

const DJsPage = () => {
	const [djs, setDJs] = useState<DJsJson[]>([]);
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
		<main className="admin-shell">
			<p className="eyebrow">Archive</p>
			<h1>DJs</h1>

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
		</main>
	);
};

createRoot(document.getElementById("root") as HTMLElement).render(
	<StrictMode>
		<DJsPage />
	</StrictMode>,
);
