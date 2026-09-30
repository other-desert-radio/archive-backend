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
			row.show_id,
			row.imported_at,
			row.imported_at === undefined ? "" : formatUTCDateTime(row.imported_at),
			row.show_name,
			row.djs.join(", "),
			row.dj_names.join(", "),
			row.duration,
			row.duration === undefined ? "" : formatDuration(row.duration),
			row.tags.join(", "),
		].join(" "),
	);
