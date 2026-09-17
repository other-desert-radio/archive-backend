import { describe, expect, test } from "bun:test";
import { createDJ } from "../../src/admin-ui/loaders/create-dj.js";

describe("createDJ loader", () => {
	test("posts the DJ payload to the admin create endpoint", async () => {
		let input: string | URL | Request | undefined;
		let init: RequestInit | undefined;
		const dj = {
			id: 42,
			title: "DJ New",
			bio: "<p>A bio</p>",
			shows: [],
			tags: [],
		};

		const result = await createDJ(
			{ title: "DJ New", bio: "A bio" },
			async (requestInput, requestInit) => {
				input = requestInput;
				init = requestInit;
				return new Response(JSON.stringify(dj), { status: 201 });
			},
		);

		expect(input).toBe("/api/admin/create-dj");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(init?.body as string)).toEqual({
			title: "DJ New",
			bio: "A bio",
		});
		expect(result).toEqual(dj);
	});

	test("rejects an unsuccessful response", async () => {
		await expect(
			createDJ(
				{ title: "DJ New", bio: "A bio" },
				async () => new Response(null, { status: 500 }),
			),
		).rejects.toThrow("Unable to create DJ");
	});
});
