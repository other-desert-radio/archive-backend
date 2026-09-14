import type { ShowsAdminRow } from "../../shows.js";

const formatDate = (value: string) => {
	const iso = new Date(value).toISOString();
	return `${iso.slice(0, 19).replace("T", " ")} UTC`;
};

const formatDuration = (seconds: number) => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;
	return [hours, minutes, remainingSeconds]
		.map((value) => value.toString().padStart(2, "0"))
		.join(":");
};

const formatIDs = (ids: number[]) =>
	ids.length === 0 ? <span className="muted">None</span> : ids.join(", ");

export const ShowsTable = ({ shows }: { shows: ShowsAdminRow[] }) => (
	<div className="table-wrapper">
		<table>
			<caption className="visually-hidden">Shows</caption>
			<thead>
				<tr>
					<th scope="col">ID</th>
					<th scope="col">Title</th>
					<th scope="col">Date</th>
					<th scope="col">Duration</th>
					<th scope="col">Image</th>
					<th scope="col">DJs</th>
					<th scope="col">Tags</th>
					<th scope="col">URL</th>
				</tr>
			</thead>
			<tbody>
				{shows.map((show) => (
					<tr key={show.id}>
						<td>{show.id}</td>
						<td>{show.title}</td>
						<td>{formatDate(show.date)}</td>
						<td>{formatDuration(show.duration)}</td>
						<td>
							{show.image ? (
								<a href={show.image} target="_blank" rel="noreferrer">
									<img src={show.image} alt={`${show.title} artwork`} />
								</a>
							) : (
								<span className="muted">None</span>
							)}
						</td>
						<td>{formatIDs(show.djs)}</td>
						<td>{formatIDs(show.tags)}</td>
						<td>
							<a href={show.url} target="_blank" rel="noreferrer">
								Open
							</a>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);
