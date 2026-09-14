import { describe, expect, test } from "bun:test";
import { loadDJs } from "../../src/admin-ui/djs.js";

describe("DJ admin data loader", () => {
	test("returns the API response", async () => {
		const djs = [
			{
				id: 1,
				title: "DJ One",
				bio: "Bio",
				shows: [],
				tags: [],
			},
		];

		const result = await loadDJs(
			async () => new Response(JSON.stringify(djs), { status: 200 }),
		);

		expect(result).toEqual(djs);
	});

	test("rejects an unsuccessful API response", async () => {
		await expect(
			loadDJs(async () => new Response(null, { status: 500 })),
		).rejects.toThrow("Unable to load DJs");
	});
});
