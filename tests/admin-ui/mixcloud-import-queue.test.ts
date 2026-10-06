import { expect, test } from "bun:test";
import { pendingMixcloudImports } from "../../src/admin-ui/components/mixcloud/index.js";
import type { MixcloudImportAdminRow } from "../../src/admin-ui/loaders/mixcloud-imports.js";

const ready = (id: number): MixcloudImportAdminRow => ({
	id,
	key: `/${id}/`,
	data_changed: false,
	djs: [],
	dj_names: [],
	tags: [],
	derived_title: "Show",
	derived_date: "2026-10-01",
	decoded_djs: ["DJ"],
	parser_version: 1,
	parser_key: "parser",
	date_source: "title",
});
test("queues each category in ID order, excludes imported rows, and preserves input order", () => {
	const rows = [
		ready(9),
		{ ...ready(3), date_source: "created_time" as const },
		ready(2),
		{ ...ready(1), show_id: 10 },
	];
	expect(
		pendingMixcloudImports(rows, "auto_parsed").map((row) => row.id),
	).toEqual([2, 9]);
	expect(
		pendingMixcloudImports(rows, "unparsable").map((row) => row.id),
	).toEqual([3]);
	expect(rows.map((row) => row.id)).toEqual([9, 3, 2, 1]);
	expect(pendingMixcloudImports([], "auto_parsed")).toEqual([]);
});
