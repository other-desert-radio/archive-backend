import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { sortResourceRows } from "../../src/admin-ui/components/shared/resource-views/index.js";
import {
	filterSpecials,
	SpecialCard,
	SpecialsTable,
	specialColumns,
} from "../../src/admin-ui/components/specials/index.js";
import { loadSpecials } from "../../src/admin-ui/loaders/specials.js";

const rows: [
	{ id: number; title: string; createdAt: string; showTitles: string[] },
	{ id: number; title: string; createdAt: string; showTitles: string[] },
] = [
	{ id: 1, title: "Night", createdAt: "", showTitles: ["Zebra", "Alpha"] },
	{ id: 2, title: "Morning", createdAt: "", showTitles: [] },
];
test("special search matches names and spelled-out shows", () => {
	expect(filterSpecials(rows, " NIGHT ")).toEqual([rows[0]]);
	expect(filterSpecials(rows, "alpha")).toEqual([rows[0]]);
	expect(filterSpecials(rows, "missing")).toEqual([]);
	expect(filterSpecials(rows, " ")).toEqual(rows);
	expect(
		sortResourceRows(rows, specialColumns, "id", "desc").map((row) => row.id),
	).toEqual([2, 1]);
	expect(
		sortResourceRows(rows, specialColumns, "title", "asc").map((row) => row.id),
	).toEqual([2, 1]);
});
test("special table spells out shows and both views disable Edit", () => {
	const table = renderToStaticMarkup(
		<SpecialsTable
			specials={rows}
			sortColumn="id"
			sortDirection="desc"
			onSort={() => {}}
			onDelete={() => {}}
		/>,
	);
	expect(table).toContain("Zebra, Alpha");
	expect(table).toContain("None");
	expect(table).toMatch(/disabled=""[^>]*>Edit/);
	const card = renderToStaticMarkup(
		<SpecialCard special={rows[0]} onDelete={() => {}} />,
	);
	expect(card).toContain("Night");
	expect(card).not.toContain("Zebra");
	expect(card).toContain('disabled=""');
});
test("special listing loader returns rows and rejects failures", async () => {
	expect(
		await loadSpecials(async (url) => {
			expect(url).toBe("/api/admin/specials");
			return Response.json(rows);
		}),
	).toEqual(rows);
	await expect(
		loadSpecials(async () => new Response("", { status: 500 })),
	).rejects.toThrow("Unable to load specials");
});
