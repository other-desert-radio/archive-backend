import { describe, expect, test } from "bun:test";
import { transformDJs } from "../../src/json-transformers/index.js";
import { groupRelationshipIds } from "../../src/json-transformers/utils/index.js";

describe("DJ JSON transformer", () => {
	test("combines direct and show-derived tags", () => {
		expect(
			transformDJs({
				djs: [
					{
						id: 1,
						createdAt: new Date("2026-01-01T00:00:00.000Z"),
						title: "DJ One",
						bio: "<p>Bio</p><script>alert(1)</script>",
						image: null,
						image_filename: null,
						socials: "<strong>@dj-one</strong><iframe>bad</iframe>",
						showTitle: "Late Night Session",
						showDescription: "A late-night broadcast.",
					},
				],
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
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				title: "DJ One",
				bio: "<p>Bio</p>",
				socials: "<strong>@dj-one</strong>bad",
				showTitle: "Late Night Session",
				showDescription: "A late-night broadcast.",
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

	test("exposes stored images as image paths", () => {
		expect(
			transformDJs({
				djs: [
					{
						id: 42,
						createdAt: new Date("2026-01-02T00:00:00.000Z"),
						title: "DJ Image",
						bio: "Bio",
						image: Buffer.from("image bytes"),
						image_filename: "dj-image.png",
						socials: null,
						showTitle: null,
						showDescription: null,
					},
				],
				showDJs: [],
				djTags: [],
				showTags: [],
			}),
		).toEqual([
			{
				id: 42,
				createdAt: new Date("2026-01-02T00:00:00.000Z"),
				title: "DJ Image",
				bio: "Bio",
				imagePath: "/api/admin/djs/42/image",
				shows: [],
				tags: [],
			},
		]);
	});
});
