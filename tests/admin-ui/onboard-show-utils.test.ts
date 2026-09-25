import { describe, expect, test } from "bun:test";
import { buildCreateShowRequest } from "../../src/admin-ui/components/shows/onboard-show-utils.js";

describe("Show onboarding payload", () => {
	test("converts duration, omits blank optional fields, and trims tags", () => {
		expect(
			buildCreateShowRequest({
				title: "  Night  ",
				date: "2026-02-03",
				hours: "1",
				minutes: "2",
				seconds: "3",
				image: " ",
				tags: " ambient, , Dance ",
				url: " https://example.com/show ",
				djs: [2],
			}),
		).toEqual({
			title: "Night",
			date: "2026-02-03",
			duration: 3723,
			url: "https://example.com/show",
			djs: [2],
			tags: ["ambient", "Dance"],
		});
	});

	test("rejects an empty or invalid duration", () => {
		const fields = {
			title: "Night",
			date: "2026-02-03",
			hours: "",
			minutes: "",
			seconds: "",
			image: "",
			tags: "",
			url: "https://example.com/show",
			djs: [2],
		};
		expect(() => buildCreateShowRequest(fields)).toThrow(
			"Duration must be positive",
		);
		expect(() => buildCreateShowRequest({ ...fields, minutes: "60" })).toThrow(
			"Duration must use",
		);
	});
});
