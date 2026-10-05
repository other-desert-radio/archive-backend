import {
	classifyMixcloudImport,
	type MixcloudImportCategory,
} from "../../../../../utils/mixcloud-import-status.js";
import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";

/** Queue membership and order are independent of the table's search and sort. */
export const pendingMixcloudImports = (
	rows: MixcloudImportAdminRow[],
	category: MixcloudImportCategory,
) =>
	rows
		.filter((row) => classifyMixcloudImport(row) === category)
		.sort((a, b) => a.id - b.id);
