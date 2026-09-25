import { describe, expect, test } from "bun:test";
import { normalizeCreateShowRequest } from "../../src/admin/routes/shows/normalize-create-show-request.js";

const validRequest = {
	title: " Night ",
	date: "2024-02-29",
	duration: 3600,
	url: " https://example.com/show ",
	djs: [2, 2, 1],
};

describe("normalizeCreateShowRequest", () => {
	test("normalizes a date-only request at midnight UTC", () => {
		const normalized = normalizeCreateShowRequest({
			...validRequest,
			image: " ",
			tags: [" Ambient ", "", "ambient", "Dance"],
		});
		expect(normalized).toMatchObject({
			title: "Night",
			date: new Date("2024-02-29T00:00:00.000Z"),
			url: "https://example.com/show",
			djs: [2, 1],
			image: null,
			tags: ["Ambient", "ambient", "Dance"],
		});
	});

	test("rejects invalid calendar dates, URLs, durations, and DJ IDs", () => {
		for (const request of [
			{ ...validRequest, date: "2024-02-30" },
			{ ...validRequest, date: "2024-02-29T00:00:00Z" },
			{ ...validRequest, date: "2023-02-29" },
			{ ...validRequest, url: "ftp://example.com/show" },
			{ ...validRequest, image: "relative-image.jpg" },
			{ ...validRequest, duration: 0 },
			{ ...validRequest, duration: 2_147_483_648 },
			{ ...validRequest, djs: [] },
			{ ...validRequest, djs: [0] },
		]) {
			expect(() => normalizeCreateShowRequest(request)).toThrow(
				"Validation error",
			);
		}
	});
});
