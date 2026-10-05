import { describe, expect, test } from "bun:test";
import { buildCreateShowRequest } from "../../src/admin-ui/components/shows/index.js";

describe("Show onboarding payload", () => {
	test("preserves duration in seconds, includes both required images, and trims tags", () => {
		expect(
			buildCreateShowRequest({
				title: "  Night  ",
				date: "2026-02-03",
				duration: "3723",
				image_small: " https://example.com/small.jpg ",
				image_large: " https://example.com/large.jpg ",
				tags: " ambient, , Dance ",
				url: " https://example.com/show ",
				djs: [2],
			}),
		).toEqual({
			title: "Night",
			date: "2026-02-03",
			duration: 3723,
			image_small: "https://example.com/small.jpg",
			image_large: "https://example.com/large.jpg",
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
			image_small: "https://example.com/small.jpg",
			image_large: "https://example.com/large.jpg",
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

test("rejects blank, relative, or non-HTTP image URLs independently", () => {
	const fields = {
		title: "Show",
		date: "2026-01-01",
		duration: "60",
		image_small: "https://example.test/small",
		image_large: "https://example.test/large",
		tags: "",
		url: "https://example.test/show",
		djs: [1],
	};
	for (const key of ["image_small", "image_large"])
		for (const value of ["", " ", "relative.jpg", "ftp://example.test/image"])
			expect(() => buildCreateShowRequest({ ...fields, [key]: value })).toThrow(
				"image must be an absolute HTTP(S) URL",
			);
});
