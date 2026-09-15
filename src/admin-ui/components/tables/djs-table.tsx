import type { DJsJSON } from "../../../json-transformers/index.js";
import type { DJSortColumn, SortDirection } from "./djs-table-utils.js";

type DJsTableProps = {
	djs: DJsJSON[];
	sortColumn: DJSortColumn;
	sortDirection: SortDirection;
	onSort: (column: DJSortColumn) => void;
};

const columns: Array<[DJSortColumn, string]> = [
	["id", "id"],
	["title", "title"],
	["image", "image"],
	["tags", "tags"],
	["socials", "socials"],
	["bio", "bio"],
	["shows", "shows"],
];
const formatIDs = (ids: number[]) =>
	ids.length === 0 ? <span className="muted">None</span> : ids.join(", ");

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
						<td>{dj.title}</td>
						<td>{dj.image ?? <span className="muted">None</span>}</td>
						<td>{formatIDs(dj.tags)}</td>
						<td>{dj.socials ?? <span className="muted">None</span>}</td>
						<td>{dj.bio}</td>
						<td>{formatIDs(dj.shows)}</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);
