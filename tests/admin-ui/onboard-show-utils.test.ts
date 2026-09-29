import { describe, expect, test } from "bun:test";
import { buildCreateShowRequest } from "../../src/admin-ui/components/shows/index.js";

describe("Show onboarding payload", () => {
	test("preserves duration in seconds, omits blank optional fields, and trims tags", () => {
		expect(
			buildCreateShowRequest({
				title: "  Night  ",
				date: "2026-02-03",
				duration: "3723",
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
			duration: "",
			image: "",
			tags: "",
			url: "https://example.com/show",
			djs: [2],
		};
		for (const duration of [
			"",
			" ",
			"0",
			"-1",
			"1.5",
			"NaN",
			"Infinity",
			"9007199254740992",
			"2147483648",
		]) {
			expect(() => buildCreateShowRequest({ ...fields, duration })).toThrow(
				"Duration must be a positive whole number of seconds",
			);
		}
		for (const duration of ["1", "60", "3600", "2147483647"]) {
			expect(buildCreateShowRequest({ ...fields, duration }).duration).toBe(
				Number(duration),
			);
		}
	});
});
