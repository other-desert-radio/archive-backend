import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SegmentedPicker } from "../../src/admin-ui/components/shared/resource-views/index.js";

test("segments expose selection, disabled state, and tooltip descriptions", () => {
	const html = renderToStaticMarkup(
		<SegmentedPicker
			label="View mode"
			value="table"
			options={[
				{ value: "grid", label: "grid", tooltip: "Show grid" },
				{ value: "table", label: "table" },
			]}
			onChange={() => {}}
			disabled
		/>,
	);
	expect(html).toContain('aria-label="View mode" disabled=""');
	expect(html).toMatch(/aria-pressed="false"[^>]*title="Show grid"/);
	expect(html).toMatch(/aria-pressed="true"[^>]*>table<\/button>/);
	expect(html).not.toContain('role="tooltip"');
});
