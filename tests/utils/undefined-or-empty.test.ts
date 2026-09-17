import { describe, expect, test } from "bun:test";
import { undefinedOrEmpty } from "../../src/utils/index.js";

describe("undefinedOrEmpty", () => {
	test("matches undefined and empty strings", () => {
		expect(undefinedOrEmpty(undefined)).toBe(true);
		expect(undefinedOrEmpty("")).toBe(true);
	});

	test("does not match non-empty strings", () => {
		expect(undefinedOrEmpty("image.jpg")).toBe(false);
	});
});
