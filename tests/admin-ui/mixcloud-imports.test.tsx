import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ManagementShell } from "../../src/admin-ui/components/layout/management-shell.js";
import {
	filterMixcloudImports,
	MixcloudTable,
	MixcloudToolbar,
	mixcloudColumns,
} from "../../src/admin-ui/components/mixcloud/index.js";
import {
	ResourceTable,
	ResourceView,
	sortResourceRows,
} from "../../src/admin-ui/components/shared/resource-views/index.js";
import {
	loadMixcloudImportStatus,
	loadMixcloudImports,
	type MixcloudImportAdminRow,
	refreshMixcloud,
} from "../../src/admin-ui/loaders/mixcloud-imports.js";

const linked: MixcloudImportAdminRow = {
	mixcloud_tag_keys: ["/genres/ambient/", "/genres/experimental/"],
	mixcloud_tags: [{ key: "/genres/ambient/", name: "AMBIENT Source" }],
	data_changed: true,
	id: 2,
	key: "/odr/test/",
	url: "https://www.mixcloud.com/odr/source-show/",
	name: "Original cloudcast",
	created_time: "2026-08-02T09:30:00.000Z",
	derived_title: "Extracted broadcast",
	derived_date: "2026-07-20T00:00:00.000Z",
	decoded_djs: ["Caroline", "Ethan"],
	parser_version: 2,
	parser_key: "common-comma-date",
	date_source: "title",
	image_small: "https://example.test/small.jpg",
	image_large: "https://example.test/large.jpg",
	show_id: 10,
	imported_at: "2026-09-01T12:00:00.000Z",
	show_name: "Ambient Hour",
	djs: [2, 9],
	dj_names: ["DJ Two", "DJ Nine"],
	duration: 3600,
	tags: [3, 5],
};
const pending: MixcloudImportAdminRow = {
	data_changed: false,
	id: 1,
	key: "/odr/pending/",
	djs: [],
	dj_names: [],
	tags: [],
};
const rows = [linked, pending];
describe("Mixcloud table", () => {
	test("refresh posts to the route and describes errors for users", async () => {
		expect(
			await refreshMixcloud((async (url, options) => {
				expect(url).toBe("/api/admin/refresh-mixcloud");
				expect(options).toEqual({ method: "POST" });
				return Response.json({ status: "ok" });
			}) as typeof fetch),
		).toEqual({ status: "ok" });
		await expect(
			refreshMixcloud((async () =>
				Response.json(
					{ error: "Internal Server Error" },
					{ status: 500 },
				)) as typeof fetch),
		).rejects.toThrow("The server encountered an unexpected error.");
		await expect(
			refreshMixcloud((async () =>
				Response.json(
					{ error: "Mixcloud is temporarily unavailable. Please try again." },
					{ status: 502 },
				)) as typeof fetch),
		).rejects.toThrow("Mixcloud is temporarily unavailable.");
		await expect(
			refreshMixcloud((async () => {
				throw new Error("fetch failed");
			}) as typeof fetch),
		).rejects.toThrow("The browser did not receive a response");
		await expect(
			refreshMixcloud((async () => {
				throw new TypeError(
					"Request cannot be constructed from a URL that includes credentials",
				);
			}) as typeof fetch),
		).rejects.toThrow("page URL contains login credentials");
		await expect(
			refreshMixcloud((async () => new Response("bad JSON")) as typeof fetch),
		).rejects.toThrow("unreadable refresh response");
		await expect(
			refreshMixcloud((async () =>
				Response.json({ status: "bad" })) as typeof fetch),
		).rejects.toThrow("unexpected refresh response");
	});
	test("refresh toolbar disables its pending action and announces feedback", () => {
		const html = renderToStaticMarkup(
			<MixcloudToolbar
				query=""
				onQueryChange={() => {}}
				onRefresh={() => {}}
				isRefreshing
				refreshFailed
				refreshMessage="Unable to refresh Mixcloud."
			/>,
		);
		expect(html).toContain("disabled");
		expect(html).toContain("Refreshing Mixcloud…");
		expect(html).toContain('role="alert"');
	});
	test("places the lowercase two-line sidebar label below tags", () => {
		const html = renderToStaticMarkup(
			<ManagementShell activeResource="mixcloud">content</ManagementShell>,
		);
		expect(html).toContain('href="#mixcloud" aria-current="page"');
		expect(html).toContain("mixcloud<br/>import");
		expect(html.indexOf('href="#mixcloud"')).toBeGreaterThan(
			html.indexOf('href="#tags"'),
		);
	});
	test("loads the resource endpoint and rejects failures", async () => {
		expect(
			await loadMixcloudImports((async (url) => {
				expect(url).toBe("/api/admin/mixcloud-imports");
				return Response.json(rows);
			}) as typeof fetch),
		).toEqual(rows);
		await expect(
			loadMixcloudImports(
				(async () => new Response(null, { status: 500 })) as typeof fetch,
			),
		).rejects.toThrow("Unable to load Mixcloud imports");
	});
	test("searches all displayed fields and formatted values", () => {
		for (const query of [
			" ambient ",
			"source-show",
			"original cloudcast",
			"09:30:00 UTC",
			"2026-08-02T09:30",
			"small.jpg",
			"large.jpg",
			"DJ NINE",
			"/odr/test/",
			"12:00:00 UTC",
			"01:00:00",
			"3, 5",
			"10",
			"2, 9",
			"extracted broadcast",
			"2026-07-20T00:00",
			"2026-07-20 00:00:00 UTC",
			"caroline, ethan",
			"common-comma-date",
			"title",
		])
			expect(filterMixcloudImports(rows, query)).toEqual([linked]);
		expect(filterMixcloudImports(rows, "missing")).toEqual([]);
		expect(filterMixcloudImports(rows, "")).toEqual(rows);
	});
	test("sorts numerically and chronologically with missing values first", () => {
		expect(sortResourceRows(rows, mixcloudColumns, "id", "asc")).toEqual([
			pending,
			linked,
		]);
		const other = {
			...linked,
			id: 9,
			duration: 90,
			imported_at: "2026-09-02T12:00:00.000Z",
			created_time: "2026-08-03T09:30:00.000Z",
		};
		expect(
			sortResourceRows([linked, other], mixcloudColumns, "duration", "asc"),
		).toEqual([other, linked]);
		expect(
			sortResourceRows(
				[other, linked, pending],
				mixcloudColumns,
				"imported_at",
				"asc",
			),
		).toEqual([pending, linked, other]);
		for (const column of [
			"created_time",
			"url",
			"name",
			"image_small",
			"image_large",
		] as const) {
			expect(
				sortResourceRows([linked, pending], mixcloudColumns, column, "asc"),
			).toEqual([pending, linked]);
		}
		expect(
			sortResourceRows(
				[other, linked, pending],
				mixcloudColumns,
				"created_time",
				"asc",
			),
		).toEqual([pending, linked, other]);
	});
	test("renders all twenty-two columns, formatted values, and no actions", () => {
		expect(mixcloudColumns.map((c) => c.label)).toEqual([
			"ID",
			"Key",
			"url",
			"name",
			"created_time",
			"derived_title",
			"derived_date",
			"decoded_djs",
			"parser_version",
			"parser_key",
			"date_source",
			"image_small",
			"image_large",
			"mixcloud_tag_json",
			"duration",
			"show_id",
			"imported_at",
			"data_changed",
			"show name",
			"djs",
			"dj names",
			"tags",
		]);
		const html = renderToStaticMarkup(
			<MixcloudTable
				rows={rows}
				sortColumn="id"
				sortDirection="asc"
				onSort={() => {}}
			/>,
		);
		expect(html).toContain("2026-09-01 12:00:00 UTC");
		expect(html).toContain("01:00:00");
		expect(html).toContain("Original cloudcast");
		expect(html).toContain("Extracted broadcast");
		expect(html).toContain("2026-07-20 00:00:00 UTC");
		expect(html).toContain("Caroline, Ethan");
		expect(html).toContain("common-comma-date");
		expect(html).toContain("2026-08-02 09:30:00 UTC");
		expect(html).toContain(
			'<a href="https://example.test/small.jpg" target="_blank" rel="noopener noreferrer">https://example.test/small.jpg</a>',
		);
		expect(html).toContain(
			'<a href="https://example.test/large.jpg" target="_blank" rel="noopener noreferrer">https://example.test/large.jpg</a>',
		);
		expect(html.match(/<a /g)).toHaveLength(2);
		expect(html).toContain("https://www.mixcloud.com/odr/source-show/");
		expect(html).toContain("DJ Two, DJ Nine");
		expect(html).toContain("None");
		expect(html).toContain("AMBIENT Source");
		expect(html).toContain(">true<");
		expect(html).toContain(">false<");
		expect(html).not.toContain("Actions");
		expect(html).not.toContain(">Edit<");
		const toolbar = renderToStaticMarkup(
			<MixcloudToolbar
				query=""
				onQueryChange={() => {}}
				onRefresh={() => {}}
				isRefreshing={false}
				refreshFailed={false}
			/>,
		);
		expect(toolbar).toContain("Search Mixcloud");
		expect(toolbar).toContain(
			'<button type="button">Refresh Mixcloud</button>',
		);
	});
	test("sorts parser fields and preserves empty arrays and version zero", () => {
		const other: MixcloudImportAdminRow = {
			...linked,
			id: 3,
			derived_title: "Z broadcast",
			derived_date: "2026-07-21T00:00:00.000Z",
			decoded_djs: ["Z DJ"],
			parser_version: 10,
			parser_key: "z-parser",
			date_source: "created_time",
		};
		for (const column of [
			"derived_title",
			"derived_date",
			"decoded_djs",
			"parser_version",
			"parser_key",
		] as const) {
			expect(
				sortResourceRows(
					[other, linked, pending],
					mixcloudColumns,
					column,
					"asc",
				),
			).toEqual([pending, linked, other]);
			expect(
				sortResourceRows(
					[other, linked, pending],
					mixcloudColumns,
					column,
					"desc",
				),
			).toEqual([other, linked, pending]);
		}
		expect(
			sortResourceRows(
				[linked, other, pending],
				mixcloudColumns,
				"date_source",
				"asc",
			),
		).toEqual([pending, other, linked]);
		expect(filterMixcloudImports([linked, other], "created_time")).toEqual([
			other,
		]);
		expect(filterMixcloudImports([linked, other], "10")).toEqual([
			linked,
			other,
		]);
		const empty = { ...pending, decoded_djs: [], parser_version: 0 };
		for (const key of ["decoded_djs", "parser_version"] as const) {
			const column = mixcloudColumns.find((c) => c.key === key);
			if (!column) throw new Error(`Missing ${key} column`);
			expect(renderToStaticMarkup(column.render(empty))).toContain(
				key === "decoded_djs" ? "None" : "0",
			);
		}
		expect(filterMixcloudImports([empty], "0")).toEqual([empty]);
	});
	test("searches and sorts the change flag", () => {
		expect(filterMixcloudImports(rows, "true")).toEqual([linked]);
		expect(filterMixcloudImports(rows, "false")).toEqual([pending]);
		expect(
			sortResourceRows(rows, mixcloudColumns, "data_changed", "asc"),
		).toEqual([pending, linked]);
		expect(
			sortResourceRows(rows, mixcloudColumns, "data_changed", "desc"),
		).toEqual([linked, pending]);
	});
	test("searches and sorts source tag keys and handles empty arrays", () => {
		expect(filterMixcloudImports(rows, "/genres/experimental/")).toEqual([
			linked,
		]);
		expect(
			sortResourceRows(rows, mixcloudColumns, "mixcloud_tags", "asc"),
		).toEqual([pending, linked]);
		const column = mixcloudColumns.find((c) => c.key === "mixcloud_tags");
		if (!column) throw new Error("Missing source tag keys column");
		expect(
			renderToStaticMarkup(
				column.render({ ...pending, mixcloud_tags: undefined }),
			),
		).toContain("None");
	});
	test("keeps existing Edit controls", () => {
		const html = renderToStaticMarkup(
			<ResourceTable
				rows={rows}
				rowKey={(r) => r.id}
				columns={mixcloudColumns}
				caption="Rows"
				sortColumn="id"
				sortDirection="asc"
				onSort={() => {}}
				onEdit={() => {}}
			/>,
		);
		expect(html).toContain("Actions");
		expect(html).toContain(">Edit<");
	});
	test("uses shared loading, retry, empty, and no-results states", () => {
		const props = {
			title: "Mixcloud",
			isLoading: false,
			onRetry: () => {},
			isEmpty: false,
			emptyMessage: "No Mixcloud imports yet.",
			children: "table",
		};
		expect(
			renderToStaticMarkup(<ResourceView {...props} isLoading />),
		).toContain("Loading Mixcloud");
		expect(
			renderToStaticMarkup(<ResourceView {...props} error="offline" />),
		).toContain("Try again");
		expect(renderToStaticMarkup(<ResourceView {...props} isEmpty />)).toContain(
			props.emptyMessage,
		);
		expect(
			renderToStaticMarkup(
				<ResourceView {...props} hasNoResults noResultsMessage="No matches" />,
			),
		).toContain("No matches");
	});
});

test("loads and validates the status endpoint", async () => {
	expect(
		await loadMixcloudImportStatus((async (url) => {
			expect(url).toBe("/api/admin/mixcloud-import/status");
			return Response.json({ auto_parsed: 0, unparsable: 12 });
		}) as typeof fetch),
	).toEqual({ auto_parsed: 0, unparsable: 12 });
	for (const invalid of [
		{ auto_parsed: -1, unparsable: 0 },
		{ auto_parsed: "1", unparsable: 0 },
		{ auto_parsed: 1.5, unparsable: 0 },
		{},
	]) {
		await expect(
			loadMixcloudImportStatus((async () =>
				Response.json(invalid)) as typeof fetch),
		).rejects.toThrow("Invalid Mixcloud import status");
	}
	await expect(
		loadMixcloudImportStatus(
			(async () => new Response(null, { status: 500 })) as typeof fetch,
		),
	).rejects.toThrow("Unable to load Mixcloud import status");
});
test("shows nonzero category counts and dialog launchers before refresh", () => {
	const html = renderToStaticMarkup(
		<MixcloudToolbar
			query=""
			onQueryChange={() => {}}
			onRefresh={() => {}}
			isRefreshing={false}
			refreshFailed={false}
			status={{ auto_parsed: 0, unparsable: 12 }}
			onOpenImport={() => {}}
		/>,
	);
	expect(html).toContain('aria-haspopup="dialog"');
	expect(html).toContain("ready for import</button>");
	expect(html).toContain("needs review<span");
	expect(html).not.toContain(">0</span>");
	expect(html).toContain(">12</span>");
	expect(html.indexOf("ready for import")).toBeLessThan(
		html.indexOf("needs review"),
	);
	expect(html.indexOf("needs review")).toBeLessThan(
		html.indexOf("Refresh Mixcloud"),
	);
});

test("source tag names and keys display, search, and sort with missing data first", () => {
	expect(filterMixcloudImports(rows, "AMBIENT Source")).toEqual([linked]);
	const column = mixcloudColumns.find(
		(column) => column.key === "mixcloud_tags",
	);
	if (!column) throw new Error("Missing source tag column");
	expect(renderToStaticMarkup(column.render(linked))).toContain(
		"AMBIENT Source",
	);
	expect(renderToStaticMarkup(column.render(pending))).toContain("None");
	expect(
		sortResourceRows(rows, mixcloudColumns, "mixcloud_tags", "asc"),
	).toEqual([pending, linked]);
});
