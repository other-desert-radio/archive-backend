import type { DJsAdminRow } from "../../loaders/djs.js";
import type { DJSortColumn, SortDirection } from "./djs-table-utils.js";

type DJsTableProps = {
	djs: DJsAdminRow[];
	sortColumn: DJSortColumn;
	sortDirection: SortDirection;
	onSort: (column: DJSortColumn) => void;
};

const columns: Array<[DJSortColumn, string]> = [
	["id", "id"],
	["createdAt", "created at"],
	["title", "title"],
	["showTitle", "show title"],
	["showDescription", "show description"],
	["imagePath", "image"],
	["tags", "tags"],
	["socials", "socials"],
	["bio", "bio"],
	["shows", "shows"],
];
const formatIDs = (ids: number[]) =>
	ids.length === 0 ? <span className="muted">None</span> : ids.join(", ");
const formatDate = (value: string) => {
	const iso = new Date(value).toISOString();
	return `${iso.slice(0, 19).replace("T", " ")} UTC`;
};

export const DJsTable = ({
	djs,
	sortColumn,
	sortDirection,
	onSort,
}: DJsTableProps) => (
	<div className="table-wrapper">
		<table>
			<caption className="visually-hidden">DJs</caption>
			<thead>
				<tr>
					{columns.map(([column, label]) => (
						<th scope="col" key={column}>
							<button
								type="button"
								className={sortColumn === column ? "active-sort" : undefined}
								onClick={() => onSort(column)}
							>
								{label}{" "}
								{sortColumn === column
									? sortDirection === "desc"
										? "▼"
										: "▲"
									: "▽"}
							</button>
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{djs.map((dj) => (
					<tr key={dj.id}>
						<td>{dj.id}</td>
						<td>{formatDate(dj.createdAt)}</td>
						<td>{dj.title}</td>
						<td>{dj.showTitle ?? <span className="muted">None</span>}</td>
						<td>{dj.showDescription ?? <span className="muted">None</span>}</td>
						<td>{dj.imagePath ?? <span className="muted">None</span>}</td>
						<td>{formatIDs(dj.tags)}</td>
						<td>{dj.socials ?? <span className="muted">None</span>}</td>
						<td>
							<div className="dj-bio">{dj.bio}</div>
						</td>
						<td>{formatIDs(dj.shows)}</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);
