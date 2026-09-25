import { describe, expect, test } from "bun:test";
import { transformTags } from "../../src/json-transformers/index.js";

describe("tag JSON transformer", () => {
	test("uses title, includes required fields, and omits absent Mixcloud metadata", () => {
		expect(
			transformTags({
				tags: [
					{
						id: 1,
						title: "Genre",
						color: "#00ff00",
						reviewed: true,
						mixcloud_key: "/genres/experimental/",
						mixcloud_url: "https://www.mixcloud.com/genres/experimental/",
					},
					{
						id: 2,
						title: "Mood",
						color: "#ff1100",
						reviewed: false,
						mixcloud_key: null,
						mixcloud_url: null,
					},
				],
			}),
		).toEqual([
			{
				id: 1,
				title: "Genre",
				color: "#00ff00",
				reviewed: true,
				mixcloud_key: "/genres/experimental/",
				mixcloud_url: "https://www.mixcloud.com/genres/experimental/",
			},
			{ id: 2, title: "Mood", color: "#ff1100", reviewed: false },
		]);
	});
});
