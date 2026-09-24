import { describe, expect, test } from "bun:test";
import { createShow } from "../../src/admin-ui/loaders/create-show.js";

const request = {
	title: "Night",
	date: "2026-02-03",
	duration: 60,
	url: "https://example.com/show",
	djs: [2],
};

describe("Show creation loader", () => {
	test("sends JSON and returns the created Show", async () => {
		let init: RequestInit | undefined;
		const created = {
			...request,
			id: 1,
			createdAt: "2026-02-01T12:00:00.000Z",
			tags: [],
		};
		expect(
			await createShow(request, async (_url, options) => {
				init = options;
				return new Response(JSON.stringify(created), { status: 201 });
			}),
		).toEqual(created);
		expect(init?.method).toBe("POST");
		expect(init?.headers).toEqual({ "content-type": "application/json" });
		expect(init?.body).toBe(JSON.stringify(request));
	});

	test("formats JSON API failures", async () => {
		await expect(
			createShow(
				request,
				async () =>
					new Response(JSON.stringify({ error: "Validation error" }), {
						status: 400,
					}),
			),
		).rejects.toThrow("Validation error");
	});
});
