import type { DJsAdminRow } from "../../loaders/djs.js";
import {
	ResourceTable,
	type ResourceTableColumn,
} from "../shared/resource-table.js";
import {
	formatMissing,
	formatRelationshipIDs,
	formatUTCDateTime,
} from "../shared/table-formatters.js";
import type { DJSortColumn, SortDirection } from "./djs-table-utils.js";

type DJsTableProps = {
	djs: DJsAdminRow[];
	sortColumn: DJSortColumn;
	sortDirection: SortDirection;
	onSort: (column: DJSortColumn) => void;
};

const SanitizedHTML = ({ html }: { html: string }) => (
	// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized by the authenticated API before rendering.
	<span dangerouslySetInnerHTML={{ __html: html }} />
);
const compareText = (left: string | undefined, right: string | undefined) =>
	(left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base" });

export const djColumns: ResourceTableColumn<DJsAdminRow, DJSortColumn>[] = [
	{
		key: "id",
		label: "id",
		render: (dj) => dj.id,
		compare: (left, right) => left.id - right.id,
	},
	{
		key: "createdAt",
		label: "created at",
		render: (dj) => formatUTCDateTime(dj.createdAt),
		compare: (left, right) => left.createdAt.localeCompare(right.createdAt),
	},
	{
		key: "title",
		label: "title",
		render: (dj) => dj.title,
		compare: (left, right) => compareText(left.title, right.title),
	},
	{
		key: "showTitle",
		label: "show title",
		render: (dj) => formatMissing(dj.showTitle),
		compare: (left, right) => compareText(left.showTitle, right.showTitle),
	},
	{
		key: "showDescription",
		label: "show description",
		render: (dj) => formatMissing(dj.showDescription),
		compare: (left, right) =>
			compareText(left.showDescription, right.showDescription),
	},
	{
		key: "imagePath",
		label: "image",
		render: (dj) => formatMissing(dj.imagePath),
		compare: (left, right) => compareText(left.imagePath, right.imagePath),
	},
	{
		key: "tags",
		label: "tags",
		render: (dj) => formatRelationshipIDs(dj.tags),
		compare: (left, right) => (left.tags[0] ?? -1) - (right.tags[0] ?? -1),
	},
	{
		key: "socials",
		label: "socials",
		render: (dj) =>
			dj.socials === undefined ? (
				formatMissing(undefined)
			) : (
				<SanitizedHTML html={dj.socials} />
			),
		compare: (left, right) => compareText(left.socials, right.socials),
	},
	{
		key: "bio",
		label: "bio",
		render: (dj) => <SanitizedHTML html={dj.bio} />,
		compare: (left, right) => compareText(left.bio, right.bio),
	},
	{
		key: "shows",
		label: "shows",
		render: (dj) => formatRelationshipIDs(dj.shows),
		compare: (left, right) => (left.shows[0] ?? -1) - (right.shows[0] ?? -1),
	},
];

export const DJsTable = ({
	djs,
	sortColumn,
	sortDirection,
	onSort,
}: DJsTableProps) => (
	<ResourceTable
		rows={djs}
		rowKey={(dj) => dj.id}
		caption="DJs"
		columns={djColumns}
		sortColumn={sortColumn}
		sortDirection={sortDirection}
		onSort={onSort}
	/>
);
