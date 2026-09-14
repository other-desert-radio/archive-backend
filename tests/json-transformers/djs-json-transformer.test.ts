import { describe, expect, test } from "bun:test";
import { transformDJs } from "../../src/json-transformers/index.js";
import { groupRelationshipIds } from "../../src/json-transformers/utils/index.js";

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

	test("can group DJs by show", () => {
		expect(
			groupRelationshipIds({
				rows: [
					{ show_id: 10, dj_id: 2 },
					{ show_id: 10, dj_id: 1 },
					{ show_id: 11, dj_id: 3 },
				],
				groupKey: "show_id",
				idKey: "dj_id",
			}),
		).toEqual(
			new Map([
				[10, [2, 1]],
				[11, [3]],
			]),
		);
	});
});
