import type { MixcloudImportAdminRow } from "../../../loaders/mixcloud-imports.js";
import {
	filterResourceRows,
	formatDuration,
	formatUTCDateTime,
} from "../../shared/resource-views/index.js";
export const filterMixcloudImports = (
	rows: MixcloudImportAdminRow[],
	query: string,
) =>
	filterResourceRows(rows, query, (row) =>
		[
			row.id,
			row.key,
			row.url,
			row.name,
			row.created_time,
			row.created_time === undefined ? "" : formatUTCDateTime(row.created_time),
			row.derived_title,
			row.derived_date,
			row.derived_date === undefined ? "" : formatUTCDateTime(row.derived_date),
			row.decoded_djs?.join(", "),
			row.parser_version,
			row.parser_key,
			row.date_source,
			row.image_small,
			row.image_large,
			row.show_id,
			row.imported_at,
			row.data_changed,
			row.imported_at === undefined ? "" : formatUTCDateTime(row.imported_at),
			row.show_name,
			row.djs.join(", "),
			row.dj_names.join(", "),
			row.duration,
			row.mixcloud_tag_keys?.join(", "),
			row.mixcloud_tags?.map(({ name, key }) => `${name} (${key})`).join(", "),
			row.duration === undefined ? "" : formatDuration(row.duration),
			row.tags.join(", "),
		].join(" "),
	);
