import { describe, expect, test } from "bun:test";
import { transformTags } from "../../src/json-transformers/index.js";

describe("tag JSON transformer", () => {
	test("uses title and includes the required color", () => {
		expect(
			transformTags({
				tags: [
					{ id: 1, title: "Genre", color: "#00ff00" },
					{ id: 2, title: "Mood", color: "#ff1100" },
				],
			}),
		).toEqual([
			{ id: 1, title: "Genre", color: "#00ff00" },
			{ id: 2, title: "Mood", color: "#ff1100" },
		]);
	});
});
