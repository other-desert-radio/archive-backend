import { describe, expect, test } from "bun:test";
import { normalizeCreateDJRequest } from "../../src/admin/routes/djs/normalize-create-dj-request.js";

describe("normalizeCreateDJRequest", () => {
	test("trims text and removes empty tag entries", () => {
		expect(
			normalizeCreateDJRequest({
				title: " DJ New ",
				image: " image.jpg ",
				tags: [" dance ", "", "  ", "house"],
				socials: " @dj-new ",
				bio: " A bio ",
			}),
		).toEqual({
			title: "DJ New",
			image: "image.jpg",
			tags: ["dance", "house"],
			socials: "@dj-new",
			bio: "A bio",
		});
	});

	test("omits blank optional text and defaults missing tags to an empty array", () => {
		expect(
			normalizeCreateDJRequest({
				title: "DJ New",
				image: "  ",
				socials: "\n",
				bio: "A bio",
			}),
		).toEqual({
			title: "DJ New",
			image: null,
			tags: [],
			socials: null,
			bio: "A bio",
		});
	});

	test("preserves duplicate tags for later resolution", () => {
		expect(
			normalizeCreateDJRequest({
				title: "DJ New",
				tags: ["Dance", "dance"],
				bio: "A bio",
			}),
		).toEqual({
			title: "DJ New",
			image: null,
			tags: ["Dance", "dance"],
			socials: null,
			bio: "A bio",
		});
	});
});
