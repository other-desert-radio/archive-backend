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
/** Sorts missing numeric values before present values. */
const compareOptionalNumbers = (
	left: number | undefined,
	right: number | undefined,
): number => {
	switch (true) {
		case left === undefined && right === undefined:
			return 0;
		case left === undefined:
			return -1;
		case right === undefined:
			return 1;
		default:
			return left - right;
	}
};
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
		key: "url",
		label: "url",
		render: (r) => formatMissing(r.url),
		compare: (a, b) => text(a.url, b.url),
	},
	{
		key: "name",
		label: "name",
		render: (r) => formatMissing(r.name),
		compare: (a, b) => text(a.name, b.name),
	},
	{
		key: "created_time",
		label: "created_time",
		render: (r) =>
			formatMissing(
				r.created_time === undefined
					? undefined
					: formatUTCDateTime(r.created_time),
			),
		compare: (a, b) =>
			compareOptionalNumbers(
				a.created_time === undefined ? undefined : Date.parse(a.created_time),
				b.created_time === undefined ? undefined : Date.parse(b.created_time),
			),
	},
	{
		key: "derived_title",
		label: "derived_title",
		render: (r) => formatMissing(r.derived_title),
		compare: (a, b) => text(a.derived_title, b.derived_title),
	},
	{
		key: "derived_date",
		label: "derived_date",
		render: (r) =>
			formatMissing(
				r.derived_date === undefined
					? undefined
					: formatUTCDateTime(r.derived_date),
			),
		compare: (a, b) =>
			compareOptionalNumbers(
				a.derived_date === undefined ? undefined : Date.parse(a.derived_date),
				b.derived_date === undefined ? undefined : Date.parse(b.derived_date),
			),
	},
	{
		key: "decoded_djs",
		label: "decoded_djs",
		render: (r) =>
			formatMissing(
				r.decoded_djs?.length ? r.decoded_djs.join(", ") : undefined,
			),
		compare: (a, b) =>
			text(a.decoded_djs?.join(", "), b.decoded_djs?.join(", ")),
	},
	{
		key: "parser_version",
		label: "parser_version",
		render: (r) => formatMissing(r.parser_version),
		compare: (a, b) =>
			compareOptionalNumbers(a.parser_version, b.parser_version),
	},
	{
		key: "parser_key",
		label: "parser_key",
		render: (r) => formatMissing(r.parser_key),
		compare: (a, b) => text(a.parser_key, b.parser_key),
	},
	{
		key: "date_source",
		label: "date_source",
		render: (r) => formatMissing(r.date_source),
		compare: (a, b) => text(a.date_source, b.date_source),
	},
	{
		key: "image_small",
		label: "image_small",
		render: (r) =>
			r.image_small ? (
				<a href={r.image_small} target="_blank" rel="noopener noreferrer">
					{r.image_small}
				</a>
			) : (
				formatMissing(r.image_small)
			),
		compare: (a, b) => text(a.image_small, b.image_small),
	},
	{
		key: "image_large",
		label: "image_large",
		render: (r) =>
			r.image_large ? (
				<a href={r.image_large} target="_blank" rel="noopener noreferrer">
					{r.image_large}
				</a>
			) : (
				formatMissing(r.image_large)
			),
		compare: (a, b) => text(a.image_large, b.image_large),
	},
	{
		key: "mixcloud_tag_keys",
		label: "mixcloud_tag_keys",
		render: (r) =>
			formatMissing(
				r.mixcloud_tag_keys?.length
					? r.mixcloud_tag_keys.join(", ")
					: undefined,
			),
		compare: (a, b) =>
			text(a.mixcloud_tag_keys?.join(", "), b.mixcloud_tag_keys?.join(", ")),
	},
	{
		key: "duration",
		label: "duration",
		render: (r) =>
			formatMissing(
				r.duration === undefined ? undefined : formatDuration(r.duration),
			),
		compare: (a, b) => compareOptionalNumbers(a.duration, b.duration),
	},
	{
		key: "show_id",
		label: "show_id",
		render: (r) => formatMissing(r.show_id),
		compare: (a, b) => compareOptionalNumbers(a.show_id, b.show_id),
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
			compareOptionalNumbers(
				a.imported_at === undefined ? undefined : Date.parse(a.imported_at),
				b.imported_at === undefined ? undefined : Date.parse(b.imported_at),
			),
	},
	{
		key: "data_changed",
		label: "data_changed",
		render: (r) => String(r.data_changed),
		compare: (a, b) => Number(a.data_changed) - Number(b.data_changed),
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
