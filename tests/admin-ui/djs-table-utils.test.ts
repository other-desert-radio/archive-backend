import { describe, expect, test } from "bun:test";
import {
	filterDJs,
	getDJSearchValue,
	sortDJs,
} from "../../src/admin-ui/components/tables/djs-table-utils.js";

const djs = [
	{
		id: 2,
		title: "Zulu",
		bio: "Late night",
		socials: "@zulu",
		shows: [10],
		tags: [1],
	},
	{ id: 1, title: "Alpha", bio: "Morning", shows: [], tags: [2] },
];

describe("DJ table helpers", () => {
	test("searches DJ fields and tag titles case-insensitively", () => {
		expect(
			getDJSearchValue(djs[0], [{ id: 1, title: "Dance", color: "#f0f" }]),
		).toContain("dance");
		expect(
			filterDJs(djs, "DANCE", [{ id: 1, title: "Dance", color: "#f0f" }]),
		).toEqual([djs[0]]);
	});

	test("sorts without mutating the source array", () => {
		expect(sortDJs(djs, "id", "desc").map((dj) => dj.id)).toEqual([2, 1]);
		expect(sortDJs(djs, "title", "asc").map((dj) => dj.title)).toEqual([
			"Alpha",
			"Zulu",
		]);
		expect(djs.map((dj) => dj.id)).toEqual([2, 1]);
	});
});
