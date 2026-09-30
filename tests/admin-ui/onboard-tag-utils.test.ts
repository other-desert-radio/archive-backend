import { expect, test } from "bun:test";
import { buildCreateTagRequest } from "../../src/admin-ui/components/tags/onboarding-modal/onboard-tag-modal/onboard-tag-utils.js";

const fields = {
	title: " Ambient ",
	color: " #aBc123 ",
	mixcloud_key: " ",
	mixcloud_url: " ",
};
test("creation trims fields and omits blank optional metadata", () => {
	expect(buildCreateTagRequest(fields)).toEqual({
		title: "Ambient",
		color: "#aBc123",
	});
	expect(
		buildCreateTagRequest({
			...fields,
			mixcloud_key: " key ",
			mixcloud_url: " https://example.test/genre ",
		}),
	).toMatchObject({
		mixcloud_key: "key",
		mixcloud_url: "https://example.test/genre",
	});
});
test("creation rejects empty titles, invalid colors and non-HTTP URLs", () => {
	for (const change of [
		{ title: " " },
		{ color: "#fff" },
		{ mixcloud_url: "relative" },
		{ mixcloud_url: "ftp://example.test" },
	])
		expect(() => buildCreateTagRequest({ ...fields, ...change })).toThrow();
});
