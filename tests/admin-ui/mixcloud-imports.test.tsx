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
	loadMixcloudImports,
	type MixcloudImportAdminRow,
	refreshMixcloud,
} from "../../src/admin-ui/loaders/mixcloud-imports.js";

const linked: MixcloudImportAdminRow = {
	data_changed: true,
	id: 2,
	key: "/odr/test/",
	url: "https://www.mixcloud.com/odr/source-show/",
	name: "Original cloudcast",
	created_time: "2026-08-02T09:30:00.000Z",
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
	test("renders all fifteen columns, formatted values, and no actions", () => {
		expect(mixcloudColumns.map((c) => c.label)).toEqual([
			"ID",
			"Key",
			"url",
			"name",
			"created_time",
			"image_small",
			"image_large",
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
