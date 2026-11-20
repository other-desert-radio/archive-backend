import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DJToolbar } from "../../src/admin-ui/components/dj/index.js";
import { GridSort } from "../../src/admin-ui/components/shared/resource-views/index.js";
import { ShowsToolbar } from "../../src/admin-ui/components/shows/index.js";
import { SpecialsToolbar } from "../../src/admin-ui/components/specials/index.js";
import { TagsToolbar } from "../../src/admin-ui/components/tags/index.js";

const noop = () => undefined;

for (const viewMode of ["grid", "table"] as const) {
	test(`resource toolbars ${viewMode === "grid" ? "show" : "hide"} grid sorting in ${viewMode} view`, () => {
		const props = {
			query: "",
			onQueryChange: noop,
			viewMode,
			onViewModeChange: noop,
			sortColumn: "title" as const,
			sortDirection: "asc" as const,
			onSortChange: noop,
		};
		const toolbars = [
			<DJToolbar key="DJToolbar" {...props} onAddDJ={noop} />,
			<TagsToolbar key="TagsToolbar" {...props} onAddTag={noop} />,
			<SpecialsToolbar key="SpecialsToolbar" {...props} onAddSpecial={noop} />,
			<ShowsToolbar
				key="ShowsToolbar"
				{...props}
				onAddShow={noop}
				pendingCount={0}
				onPendingUploads={noop}
			/>,
		];
		for (const toolbar of toolbars) {
			const html = renderToStaticMarkup(toolbar);
			expect(html.includes("<select")).toBe(viewMode === "grid");
			if (viewMode === "grid") {
				for (const label of ["added ↑", "added ↓", "A–Z", "Z–A"])
					expect(html).toContain(label);
				expect(html.indexOf("<select")).toBeLessThan(
					html.indexOf('aria-label="View mode"'),
				);
				expect(html.includes("show date ↑")).toBe(
					toolbar.type === ShowsToolbar,
				);
			}
		}
	});
}

test("grid sorting sends the chosen column and direction to its caller", () => {
	const changes: string[] = [];
	const picker = GridSort({
		label: "Sort tags",
		viewMode: "grid",
		sortColumn: "id",
		sortDirection: "desc",
		addedColumn: "id",
		titleColumn: "title",
		onSortChange: (column, direction) => changes.push(`${column}:${direction}`),
	});
	expect(picker).not.toBeNull();
	if (!picker) throw new Error("Expected grid sort control");
	const select = picker.props.children;
	for (const value of [
		"id:asc",
		"id:desc",
		"title:asc",
		"title:desc",
		"invalid",
	])
		select.props.onChange({ target: { value } });
	expect(changes).toEqual(["id:asc", "id:desc", "title:asc", "title:desc"]);
});
