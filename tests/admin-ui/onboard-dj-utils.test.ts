import { describe, expect, test } from "bun:test";
import { buildCreateDJRequest } from "../../src/admin-ui/components/onboard-dj-utils.js";

describe("buildCreateDJRequest", () => {
	test("trims fields and parses comma-separated tags", () => {
		expect(
			buildCreateDJRequest({
				title: " DJ New ",
				image: " image.jpg ",
				tags: " dance, , house ",
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

	test("omits empty optional fields", () => {
		expect(
			buildCreateDJRequest({
				title: "DJ New",
				image: " ",
				tags: "",
				socials: "\n",
				bio: "A bio",
			}),
		).toEqual({ title: "DJ New", bio: "A bio" });
	});
});
