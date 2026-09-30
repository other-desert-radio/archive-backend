import type { MixcloudImportAdminRow as Row } from "../../../loaders/mixcloud-imports.js";
import {
	formatDuration,
	formatMissing,
	formatRelationshipIDs,
	formatUTCDateTime,
	ResourceTable,
	type ResourceTableColumn,
	type SortDirection,
} from "../../shared/resource-views/index.js";
export type MixcloudSortColumn = keyof Row;
const text = (a: string | undefined, b: string | undefined) =>
	(a ?? "").localeCompare(b ?? "");
const number = (a: number | undefined, b: number | undefined) =>
	a === undefined ? (b === undefined ? 0 : -1) : b === undefined ? 1 : a - b;
export const mixcloudColumns: ResourceTableColumn<Row, MixcloudSortColumn>[] = [
	{
		key: "id",
		label: "ID",
		render: (r) => r.id,
		compare: (a, b) => a.id - b.id,
	},
	{
		key: "key",
		label: "Key",
		render: (r) => r.key,
		compare: (a, b) => text(a.key, b.key),
	},
	{
		key: "show_id",
		label: "show_id",
		render: (r) => formatMissing(r.show_id),
		compare: (a, b) => number(a.show_id, b.show_id),
	},
	{
		key: "imported_at",
		label: "imported_at",
		render: (r) =>
			formatMissing(
				r.imported_at === undefined
					? undefined
					: formatUTCDateTime(r.imported_at),
			),
		compare: (a, b) =>
			number(
				a.imported_at === undefined ? undefined : Date.parse(a.imported_at),
				b.imported_at === undefined ? undefined : Date.parse(b.imported_at),
			),
	},
	{
		key: "show_name",
		label: "show name",
		render: (r) => formatMissing(r.show_name),
		compare: (a, b) => text(a.show_name, b.show_name),
	},
	{
		key: "djs",
		label: "djs",
		render: (r) => formatRelationshipIDs(r.djs),
		compare: (a, b) => text(a.djs.join(", "), b.djs.join(", ")),
	},
	{
		key: "dj_names",
		label: "dj names",
		render: (r) =>
			formatMissing(
				r.dj_names.length === 0 ? undefined : r.dj_names.join(", "),
			),
		compare: (a, b) => text(a.dj_names.join(", "), b.dj_names.join(", ")),
	},
	{
		key: "duration",
		label: "duration",
		render: (r) =>
			formatMissing(
				r.duration === undefined ? undefined : formatDuration(r.duration),
			),
		compare: (a, b) => number(a.duration, b.duration),
	},
	{
		key: "tags",
		label: "tags",
		render: (r) => formatRelationshipIDs(r.tags),
		compare: (a, b) => text(a.tags.join(", "), b.tags.join(", ")),
	},
];
type Props = {
	rows: Row[];
	sortColumn: MixcloudSortColumn;
	sortDirection: SortDirection;
	onSort: (column: MixcloudSortColumn) => void;
};
export const MixcloudTable = (props: Props) => (
	<ResourceTable
		{...props}
		rowKey={(r) => r.id}
		caption="Mixcloud"
		columns={mixcloudColumns}
	/>
);
