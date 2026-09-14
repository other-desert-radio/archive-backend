import { describe, expect, test } from "bun:test";
import { transformDJs } from "../../src/json-transformers/index.js";

describe("DJ JSON transformer", () => {
	test("combines direct and show-derived tags", () => {
		expect(
			transformDJs({
				djs: [{ id: 1, title: "DJ One", bio: "Bio", image: null }],
				showDJs: [
					{ dj_id: 1, show_id: 10 },
					{ dj_id: 1, show_id: 11 },
				],
				djTags: [{ dj_id: 1, tag_id: 20 }],
				showTags: [
					{ dj_id: 1, tag_id: 21 },
					{ dj_id: 1, tag_id: 20 },
				],
			}),
		).toEqual([
			{
				id: 1,
				title: "DJ One",
				bio: "Bio",
				shows: [10, 11],
				tags: [20, 21],
			},
		]);
	});
});
