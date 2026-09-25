import { describe, expect, test } from "bun:test";
import { buildCreateDJRequest } from "../../src/admin-ui/components/dj/onboard-dj-utils.js";

describe("buildCreateDJRequest", () => {
	test("trims fields and parses comma-separated tags", () => {
		const image = new File(["image bytes"], "image.jpg", {
			type: "image/jpeg",
		});
		expect(
			buildCreateDJRequest({
				title: " DJ New ",
				image,
				tags: ["dance"],
				tagDraft: " house ",
				socials: " @dj-new ",
				showTitle: " Late Night Session ",
				showDescription: " Late-night broadcast ",
				bio: " A bio ",
			}),
		).toEqual({
			title: "DJ New",
			image,
			tags: ["dance", "house"],
			socials: "@dj-new",
			showTitle: "Late Night Session",
			showDescription: "Late-night broadcast",
			bio: "A bio",
		});
	});

	test("omits empty optional fields", () => {
		expect(
			buildCreateDJRequest({
				title: "DJ New",
				tags: [],
				tagDraft: "",
				socials: "\n",
				showTitle: "\n",
				showDescription: " ",
				bio: "A bio",
			}),
		).toEqual({ title: "DJ New", bio: "A bio" });
	});
});
