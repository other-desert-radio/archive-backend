import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const stylesheet = new URL(
	"../../src/admin-ui/components/dj/modal/edit-dj-modal.module.css",
	import.meta.url,
);

describe("Edit DJ modal layout", () => {
	test("keeps show-derived tags paired with their label in the form grid", async () => {
		const css = await readFile(stylesheet, "utf8");

		expect(css).toContain(".inheritedTags {\n\tdisplay: contents;");
		expect(css).toContain(".inheritedTagsList {\n\tgrid-column: 2;");
	});
});
