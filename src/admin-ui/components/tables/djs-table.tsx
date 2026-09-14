import type { DJsJSON } from "../../../json-transformers/index.js";

export const DJsTable = ({ djs }: { djs: DJsJSON[] }) => (
	<div className="table-wrapper">
		<table>
			<caption className="visually-hidden">DJs</caption>
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
);
