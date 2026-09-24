import type { TagsAdminRow } from "../../loaders/tags.js";

export const TagsTable = ({ tags }: { tags: TagsAdminRow[] }) => (
	<div className="table-wrapper">
		<table>
			<caption className="visually-hidden">Tags</caption>
			<thead>
				<tr>
					<th scope="col">ID</th>
					<th scope="col">Title</th>
					<th scope="col">Color</th>
					<th scope="col">Mixcloud key</th>
					<th scope="col">Mixcloud URL</th>
				</tr>
			</thead>
			<tbody>
				{tags.map((tag) => (
					<tr key={tag.id}>
						<td>{tag.id}</td>
						<td>{tag.title}</td>
						<td>{tag.color}</td>
						<td>{tag.mixcloud_key ?? "—"}</td>
						<td>
							{tag.mixcloud_url === undefined ? (
								"—"
							) : (
								<a href={tag.mixcloud_url}>{tag.mixcloud_url}</a>
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);
