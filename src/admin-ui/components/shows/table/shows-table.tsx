import type { ShowsAdminRow } from "../../../loaders/shows.js";
import {
	formatDuration,
	formatRelationshipIDs,
	formatUTCDate,
	formatUTCDateTime,
	ResourceTable,
	type ResourceTableColumn,
} from "../../shared/resource-views/index.js";
import type { ShowSortColumn, SortDirection } from "./shows-table-utils.js";

type ShowsTableProps = {
	shows: ShowsAdminRow[];
	sortColumn: ShowSortColumn;
	sortDirection: SortDirection;
	onSort: (column: ShowSortColumn) => void;
	onEdit: (show: ShowsAdminRow) => void;
};

const compareText = (left: string | undefined, right: string | undefined) =>
	(left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });
const formatURL = (url: string) => {
	try {
		const parsed = new URL(url);
		return parsed.protocol === "http:" || parsed.protocol === "https:" ? (
			<a href={url} target="_blank" rel="noreferrer">
				{url}
			</a>
		) : (
			url
		);
	} catch {
		return url;
	}
};

export const showColumns: ResourceTableColumn<ShowsAdminRow, ShowSortColumn>[] =
	[
		{
			key: "id",
			label: "id",
			render: (show) => show.id,
			compare: (a, b) => a.id - b.id,
		},
		{
			key: "createdAt",
			label: "created at",
			render: (show) => formatUTCDateTime(show.createdAt),
			compare: (a, b) => a.createdAt.localeCompare(b.createdAt),
		},
		{
			key: "title",
			label: "title",
			render: (show) => show.title,
			compare: (a, b) => compareText(a.title, b.title),
		},
		{
			key: "date",
			label: "date",
			render: (show) => formatUTCDate(show.date),
			compare: (a, b) => a.date.localeCompare(b.date),
		},
		{
			key: "duration",
			label: "duration",
			render: (show) => formatDuration(show.duration),
			compare: (a, b) => a.duration - b.duration,
		},
		{
			key: "image_small",
			label: "image_small",
			render: (show) => formatURL(show.image_small),
			compare: (a, b) => compareText(a.image_small, b.image_small),
		},
		{
			key: "image_large",
			label: "image_large",
			render: (show) => formatURL(show.image_large),
			compare: (a, b) => compareText(a.image_large, b.image_large),
		},
		{
			key: "djs",
			label: "DJs",
			render: (show) => formatRelationshipIDs(show.djs),
			compare: (a, b) => (a.djs[0] ?? -1) - (b.djs[0] ?? -1),
		},
		{
			key: "tags",
			label: "tags",
			render: (show) => formatRelationshipIDs(show.tags),
			compare: (a, b) => (a.tags[0] ?? -1) - (b.tags[0] ?? -1),
		},
		{
			key: "url",
			label: "URL",
			render: (show) => formatURL(show.url),
			compare: (a, b) => compareText(a.url, b.url),
		},
	];

export const ShowsTable = ({
	shows,
	sortColumn,
	sortDirection,
	onSort,
	onEdit,
}: ShowsTableProps) => (
	<ResourceTable
		rows={shows}
		rowKey={(show) => show.id}
		caption="Shows"
		columns={showColumns}
		sortColumn={sortColumn}
		sortDirection={sortDirection}
		onSort={onSort}
		onEdit={onEdit}
	/>
);
