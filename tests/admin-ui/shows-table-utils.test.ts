import { describe, expect, test } from "bun:test";
import {
	filterShows,
	getShowSearchValue,
	showColumns,
	sortShows,
} from "../../src/admin-ui/components/shows/index.js";

const shows = [
	{
		id: 2,
		createdAt: "2026-01-02T12:34:56.000Z",
		title: "Zulu Broadcast",
		date: "2026-01-02T00:00:00.000Z",
		duration: 90061,
		image_small: "https://example.com/zulu-small.jpg",
		image_large: "https://example.com/alpha-large.jpg",
		djs: [4],
		tags: [7],
		url: "https://example.com/zulu",
	},
	{
		id: 1,
		createdAt: "2026-01-01T01:02:03.000Z",
		title: "Alpha Broadcast",
		date: "2025-12-31T23:00:00.000Z",
		duration: 60,
		djs: [],
		tags: [],
		url: "legacy-show-url",
		image_small: "https://example.com/alpha-small.jpg",
		image_large: "https://example.com/zulu-large.jpg",
	},
];

describe("Show table helpers", () => {
	test("uses the specified columns and UTC timestamp/date presentation", () => {
		expect(showColumns.map((column) => column.label)).toEqual([
			"id",
			"created at",
			"title",
			"date",
			"duration",
			"image_small",
			"image_large",
			"DJs",
			"tags",
			"URL",
		]);
		expect(showColumns[1].render(shows[0])).toBe("2026-01-02 12:34:56 UTC");
		expect(showColumns[3].render(shows[1])).toBe("2025-12-31");
	});

	test("searches formatted values and resolved relationship names", () => {
		const djs = new Map([[4, "Night DJ"]]);
		const tags = new Map([[7, "Ambient"]]);

		expect(getShowSearchValue(shows[0], djs, tags)).toContain("2026-01-02");
		expect(getShowSearchValue(shows[0], djs, tags)).toContain("25:01:01");
		expect(filterShows(shows, "NIGHT DJ", djs, tags)).toEqual([shows[0]]);
		expect(filterShows(shows, "ambient", djs, tags)).toEqual([shows[0]]);
		expect(filterShows(shows, "legacy-show-url", djs, tags)).toEqual([
			shows[1],
		]);
		expect(filterShows(shows, "no matching show", djs, tags)).toEqual([]);
	});

	test("sorts numerically and preserves the input array", () => {
		expect(sortShows(shows, "id", "desc").map((show) => show.id)).toEqual([
			2, 1,
		]);
		expect(sortShows(shows, "duration", "asc").map((show) => show.id)).toEqual([
			1, 2,
		]);
		expect(sortShows(shows, "djs", "asc").map((show) => show.id)).toEqual([
			1, 2,
		]);
		expect(shows.map((show) => show.id)).toEqual([2, 1]);
	});
});

test("searches, links, and sorts both image URLs independently", () => {
	const show = shows[0];
	if (show === undefined) throw new Error("Missing fixture");
	for (const key of ["image_small", "image_large"] as const) {
		expect(filterShows(shows, show[key], new Map(), new Map())).toEqual([
			shows[0],
		]);
		const column = showColumns.find((column) => column.key === key);
		if (column === undefined) throw new Error("Missing column");
		expect(column.render(show).props).toMatchObject({
			href: show[key],
			target: "_blank",
		});
	}
	expect(sortShows(shows, "image_small", "asc").map((show) => show.id)).toEqual(
		[1, 2],
	);
	expect(sortShows(shows, "image_large", "asc").map((show) => show.id)).toEqual(
		[2, 1],
	);
});
