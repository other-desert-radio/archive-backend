import { describe, expect, test } from "bun:test";
import {
	commitTagDraft,
	findTagMatches,
	getTagCompletion,
	uniqueTagTitles,
} from "../../src/admin-ui/components/shared/tags-input-utils.js";

const options = [
	{ id: 1, title: "Dance", color: "#ff03d1" },
	{ id: 2, title: "Dark ambient", color: "#57cfff" },
	{ id: 3, title: "Experimental", color: "#ffe657" },
];

describe("tag input helpers", () => {
	test("commits comma-separated drafts and removes case-insensitive duplicates", () => {
		expect(commitTagDraft(["Dance"], " dance, house, , HOUSE ")).toEqual([
			"Dance",
			"house",
		]);
	});
	test("orders prefix matches before other substring matches and excludes selected tags", () => {
		expect(findTagMatches("da", options, ["Dance"])).toEqual([options[1]]);
		expect(findTagMatches("a", options, [])).toEqual([
			options[0],
			options[1],
			options[2],
		]);
	});
	test("only creates completion text for prefix matches", () => {
		expect(getTagCompletion("da", options[0])).toBe("nce");
		expect(getTagCompletion("an", options[0])).toBeUndefined();
	});
	test("trims selected values without changing their original spelling", () => {
		expect(uniqueTagTitles([" Dance ", "dance", "House"])).toEqual([
			"Dance",
			"House",
		]);
	});
});
