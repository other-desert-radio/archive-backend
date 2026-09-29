import { describe, expect, test } from "bun:test";
import { hasFormChanges } from "../../src/admin-ui/components/shared/modal/index.js";

describe("unsaved form changes", () => {
	test("restoring text and tag drafts clears changes", () => {
		const initial = { title: "DJ", tagDraft: "" };
		expect(hasFormChanges({ ...initial, title: "Other" }, initial)).toBe(true);
		expect(hasFormChanges({ ...initial, tagDraft: "ambient" }, initial)).toBe(
			true,
		);
		expect(hasFormChanges({ ...initial }, initial)).toBe(false);
	});
	test("relationship selections are compared by membership", () => {
		expect(hasFormChanges({ selected: [2, 1] }, { selected: [1, 2] })).toBe(
			false,
		);
		expect(hasFormChanges({ selected: [1, 3] }, { selected: [1, 2] })).toBe(
			true,
		);
		expect(hasFormChanges({ tags: ["dub"] }, { tags: [] })).toBe(true);
	});
	test("accepted images and removal count, undo clears removal", () => {
		const initial = { image: undefined, removeImage: false };
		expect(
			hasFormChanges(
				{ ...initial, image: new File(["image"], "crop.webp") },
				initial,
			),
		).toBe(true);
		expect(hasFormChanges({ ...initial, removeImage: true }, initial)).toBe(
			true,
		);
		expect(hasFormChanges(initial, initial)).toBe(false);
	});
});
