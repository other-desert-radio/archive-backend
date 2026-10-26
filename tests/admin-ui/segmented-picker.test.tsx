import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SegmentedPicker } from "../../src/admin-ui/components/shared/resource-views/index.js";

test("segments expose selection, disabled state, and tooltip descriptions", () => {
	const html = renderToStaticMarkup(
		<SegmentedPicker
			label="Show mode"
			value="existing_show"
			options={[
				{ value: "new_show", label: "new show", tooltip: "Upload to Mixcloud" },
				{ value: "existing_show", label: "existing show" },
			]}
			onChange={() => {}}
			disabled
		/>,
	);
	expect(html).toContain('aria-label="Show mode" disabled=""');
	expect(html).toMatch(/aria-pressed="false"[^>]*title="Upload to Mixcloud"/);
	expect(html).toMatch(/aria-pressed="true"[^>]*>existing show<\/button>/);
	expect(html).not.toContain('role="tooltip"');
});
