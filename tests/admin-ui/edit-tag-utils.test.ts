import { describe, expect, test } from "bun:test";
import {
	buildModifyTagRequest,
	isTagColor,
} from "../../src/admin-ui/components/tags/onboarding-modal/edit-tag-modal/edit-tag-utils.js";

const fields = {
	title: " Ambient ",
	color: " #aBc123 ",
	mixcloud_key: " key ",
	mixcloud_url: " https://example.test/genre ",
};
describe("Tag edit payload", () => {
	test("trims every field and includes clearing values", () => {
		expect(buildModifyTagRequest(1, fields)).toEqual({
			id: 1,
			title: "Ambient",
			color: "#aBc123",
			mixcloud_key: "key",
			mixcloud_url: "https://example.test/genre",
		});
		expect(
			buildModifyTagRequest(1, {
				...fields,
				mixcloud_key: " ",
				mixcloud_url: " ",
			}),
		).toMatchObject({ mixcloud_key: "", mixcloud_url: "" });
	});
	test("validates ID, title, hex color, and URL before sending", () => {
		for (const change of [
			{ title: " " },
			{ color: "red" },
			{ color: "#fff" },
			{ mixcloud_url: "relative" },
			{ mixcloud_url: "ftp://example.test" },
		])
			expect(() =>
				buildModifyTagRequest(1, { ...fields, ...change }),
			).toThrow();
		expect(() => buildModifyTagRequest(0, fields)).toThrow();
		expect(() =>
			buildModifyTagRequest(1, {
				...fields,
				mixcloud_url: "http://example.test",
			}),
		).not.toThrow();
		expect(isTagColor(" #abcdef ")).toBe(true);
		expect(isTagColor("#fff")).toBe(false);
	});
});
