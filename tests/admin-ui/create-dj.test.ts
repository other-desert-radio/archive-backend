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
			{
				title: "DJ New",
				bio: "A bio",
				showTitle: "Late Night Session",
				showDescription: "Late-night broadcast",
			},
			async (requestInput, requestInit) => {
				input = requestInput;
				init = requestInit;
				return new Response(JSON.stringify(dj), { status: 201 });
			},
		);

		expect(input).toBe("/api/admin/create-dj");
		expect(init?.method).toBe("POST");
		expect(init?.headers).toBeUndefined();
		const body = init?.body as FormData;
		expect(body).toBeInstanceOf(FormData);
		expect(body.get("title")).toBe("DJ New");
		expect(body.get("bio")).toBe("A bio");
		expect(body.get("showTitle")).toBe("Late Night Session");
		expect(body.get("showDescription")).toBe("Late-night broadcast");
		expect(result).toEqual(dj);
	});

	test("rejects an unsuccessful response", async () => {
		await expect(
			createDJ(
				{ title: "DJ New", bio: "A bio" },
				async () =>
					new Response(JSON.stringify({ error: "Image filename is invalid" }), {
						status: 400,
						statusText: "Bad Request",
					}),
			),
		).rejects.toThrow(
			"DJ could not be created. The server returned HTTP 400 (Bad Request): Image filename is invalid. Please correct this issue and try again.",
		);
	});

	test("describes failures without a JSON error body", async () => {
		await expect(
			createDJ(
				{ title: "DJ New", bio: "A bio" },
				async () =>
					new Response(null, {
						status: 500,
						statusText: "Internal Server Error",
					}),
			),
		).rejects.toThrow(
			"DJ could not be created. The server returned HTTP 500 (Internal Server Error). Please check the form and image, then try again.",
		);
	});
});
