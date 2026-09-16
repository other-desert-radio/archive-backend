import { describe, expect, test } from "bun:test";
import { validateTags } from "../../src/utils/validate-tags.js";

describe("validateTags", () => {
	test("returns valid and invalid tags, including empty strings", async () => {
		const result = await validateTags({
			incomingTags: [" house ", "unknown", ""],
			existingTags: ["House", "Techno"],
		});

		expect(result).toEqual({
			valid: ["house"],
			invalid: ["unknown", ""],
		});
	});

	test("matches existing tags case-insensitively", async () => {
		const result = await validateTags({
			incomingTags: ["TECHNO"],
			existingTags: ["House", "Techno"],
		});

		expect(result).toEqual({ valid: ["TECHNO"], invalid: [] });
	});
});
