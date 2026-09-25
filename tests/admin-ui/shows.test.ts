import { describe, expect, test } from "bun:test";
import { loadShows } from "../../src/admin-ui/loaders/shows.js";

describe("shows admin data loader", () => {
	test("returns the API response", async () => {
		const shows = [
			{
				id: 1,
				createdAt: "2025-12-31T23:00:00.000Z",
				title: "Show One",
				date: "2026-01-01T00:00:00.000Z",
				duration: 3600,
				djs: [2],
				tags: [3],
				url: "https://example.com/show-one",
			},
		];

		const result = await loadShows(
			async () => new Response(JSON.stringify(shows), { status: 200 }),
		);

		expect(result).toEqual(shows);
	});

	test("rejects an unsuccessful API response", async () => {
		await expect(
			loadShows(async () => new Response(null, { status: 500 })),
		).rejects.toThrow("Unable to load shows");
	});
});
