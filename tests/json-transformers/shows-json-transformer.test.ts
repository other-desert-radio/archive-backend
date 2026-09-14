import { describe, expect, test } from "bun:test";
import { transformShows } from "../../src/json-transformers/index.js";

describe("show JSON transformer", () => {
	test("includes related DJs and tags and omits null images", () => {
		expect(
			transformShows({
				shows: [
					{
						id: 10,
						title: "Show One",
						date: new Date("2026-01-01"),
						duration: 3600,
						image: null,
						url: "https://example.com/show-one",
					},
					{
						id: 11,
						title: "Show Two",
						date: new Date("2026-01-02"),
						duration: 1800,
						image: "show-two.jpg",
						url: "https://example.com/show-two",
					},
				],
				showDJs: [
					{ show_id: 10, dj_id: 2 },
					{ show_id: 10, dj_id: 1 },
				],
				showTags: [
					{ show_id: 10, tag_id: 20 },
					{ show_id: 10, tag_id: 21 },
				],
			}),
		).toEqual([
			{
				id: 10,
				title: "Show One",
				date: new Date("2026-01-01"),
				duration: 3600,
				url: "https://example.com/show-one",
				djs: [2, 1],
				tags: [20, 21],
			},
			{
				id: 11,
				title: "Show Two",
				date: new Date("2026-01-02"),
				duration: 1800,
				image: "show-two.jpg",
				url: "https://example.com/show-two",
				djs: [],
				tags: [],
			},
		]);
	});
});
