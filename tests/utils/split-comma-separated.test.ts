import { describe, expect, test } from "bun:test";
import { splitCommaSeparated } from "../../src/utils/index.js";

describe("splitCommaSeparated", () => {
	test("trims values and removes empty entries", () => {
		expect(splitCommaSeparated(" dance, , house ,, techno ")).toEqual([
			"dance",
			"house",
			"techno",
		]);
	});

	test("returns an empty array for blank input", () => {
		expect(splitCommaSeparated(" \n ")).toEqual([]);
	});
});
