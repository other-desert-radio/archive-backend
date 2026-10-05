import { describe, expect, test } from "bun:test";
import { modifyShow } from "../../src/admin-ui/loaders/modify-show.js";

const payload = {
	id: 42,
	title: "Changed Show",
	date: "2024-02-29",
	duration: 3661,
	image_small: "https://example.test/small.jpg",
	image_large: "https://example.test/large.jpg",
	url: "https://example.test/show",
	djs: [1],
	tags: [],
};
describe("modifyShow loader", () => {
	test("posts replacement JSON and returns the saved Show", async () => {
		const saved = { ...payload, createdAt: "2026-01-01T00:00:00Z" };
		const result = await modifyShow(payload, async (input, init) => {
			expect(input).toBe("/api/admin/modify-show");
			expect(init?.method).toBe("POST");
			expect(init?.headers).toEqual({ "content-type": "application/json" });
			expect(JSON.parse(init?.body as string)).toEqual(payload);
			return new Response(JSON.stringify(saved));
		});
		expect(result).toEqual(saved);
	});
	test("describes failed saves with HTTP and safe server details", async () => {
		await expect(
			modifyShow(
				payload,
				async () =>
					new Response('{"error":"Internal Server Error"}', { status: 500 }),
			),
		).rejects.toThrow(
			"Show could not be saved.\n\nThe server encountered an unexpected error.",
		);
		await expect(
			modifyShow(
				payload,
				async () => new Response('{"error":"Not Found"}', { status: 404 }),
			),
		).rejects.toThrow("Not Found");
	});
});
