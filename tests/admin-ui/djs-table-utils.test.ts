import { describe, expect, test } from "bun:test";
import {
	filterDJs,
	getDJSearchValue,
	sortDJs,
} from "../../src/admin-ui/components/tables/djs-table-utils.js";

const djs = [
	{
		id: 2,
		createdAt: "2026-01-02T00:00:00.000Z",
		title: "Zulu",
		bio: "Late night",
		socials: "@zulu",
		showTitle: "Night Drive",
		showDescription: "A late-night broadcast",
		shows: [10],
		tags: [1],
	},
	{
		id: 1,
		createdAt: "2026-01-01T00:00:00.000Z",
		title: "Alpha",
		bio: "Morning",
		shows: [],
		tags: [2],
	},
];

describe("DJ table helpers", () => {
	test("searches DJ fields and tag titles case-insensitively", () => {
		expect(
			getDJSearchValue(djs[0], [{ id: 1, title: "Dance", color: "#f0f" }]),
		).toContain("dance");
		expect(getDJSearchValue(djs[0], [])).toContain("night drive");
		expect(filterDJs(djs, "late-night broadcast", [])).toEqual([djs[0]]);
		expect(
			filterDJs(djs, "DANCE", [{ id: 1, title: "Dance", color: "#f0f" }]),
		).toEqual([djs[0]]);
	});

	test("sorts without mutating the source array", () => {
		expect(sortDJs(djs, "id", "desc").map((dj) => dj.id)).toEqual([2, 1]);
		expect(sortDJs(djs, "createdAt", "asc").map((dj) => dj.id)).toEqual([1, 2]);
		expect(sortDJs(djs, "title", "asc").map((dj) => dj.title)).toEqual([
			"Alpha",
			"Zulu",
		]);
		expect(djs.map((dj) => dj.id)).toEqual([2, 1]);
	});
});
