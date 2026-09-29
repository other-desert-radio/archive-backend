import { describe, expect, test } from "bun:test";
import { modifyDJ } from "../../src/admin-ui/loaders/modify-dj.js";

describe("modifyDJ loader", () => {
	test("posts a complete replacement payload to the admin edit endpoint", async () => {
		let input: string | URL | Request | undefined;
		let init: RequestInit | undefined;
		const image = new File(["cropped image"], "portrait.webp", {
			type: "image/webp",
		});
		const result = await modifyDJ(
			{
				id: 42,
				title: "DJ Updated",
				bio: "Updated bio",
				tags: ["dance", "house"],
				socials: "@dj-updated",
				showTitle: "Late Night",
				showDescription: "An updated broadcast.",
				image,
				removeImage: false,
			},
			async (requestInput, requestInit) => {
				input = requestInput;
				init = requestInit;
				return new Response(
					JSON.stringify({
						id: 42,
						title: "DJ Updated",
						bio: "<p>Updated bio</p>",
						shows: [],
						tags: [1, 2],
						directTags: [1, 2],
					}),
					{ status: 200 },
				);
			},
		);

		expect(input).toBe("/api/admin/modify-dj");
		expect(init?.method).toBe("POST");
		const body = init?.body as FormData;
		expect(body.get("id")).toBe("42");
		expect(body.get("title")).toBe("DJ Updated");
		expect(body.get("bio")).toBe("Updated bio");
		expect(body.get("tags")).toBe("dance,house");
		expect(body.get("socials")).toBe("@dj-updated");
		expect(body.get("showTitle")).toBe("Late Night");
		expect(body.get("showDescription")).toBe("An updated broadcast.");
		expect(body.get("removeImage")).toBe("false");
		const uploaded = body.get("image");
		expect(uploaded).toBeInstanceOf(File);
		expect((uploaded as File).name).toBe("portrait.webp");
		expect((uploaded as File).type).toBe("image/webp");
		expect(result.title).toBe("DJ Updated");
	});

	test("submits blank optional fields and image removal explicitly", async () => {
		let body: FormData | undefined;
		await modifyDJ(
			{
				id: 42,
				title: "DJ Updated",
				bio: "Updated bio",
				tags: [],
				removeImage: true,
			},
			async (_, requestInit) => {
				body = requestInit?.body as FormData;
				return new Response(
					JSON.stringify({
						id: 42,
						title: "DJ Updated",
						bio: "<p>Updated bio</p>",
						shows: [],
						tags: [],
						directTags: [],
					}),
					{ status: 200 },
				);
			},
		);

		expect(body?.get("tags")).toBe("");
		expect(body?.get("socials")).toBe("");
		expect(body?.get("showTitle")).toBe("");
		expect(body?.get("showDescription")).toBe("");
		expect(body?.get("removeImage")).toBe("true");
		expect(body?.get("image")).toBeNull();
	});

	test("describes an unsuccessful response", async () => {
		await expect(
			modifyDJ(
				{
					id: 42,
					title: "DJ Updated",
					bio: "Updated bio",
					tags: [],
					removeImage: false,
				},
				async () =>
					new Response(JSON.stringify({ error: "Not Found" }), {
						status: 404,
						statusText: "Not Found",
					}),
			),
		).rejects.toThrow(
			"DJ could not be updated.\n\nNot Found\n\nStatus: HTTP 404 (Not Found)\nPlease correct this issue and try again.",
		);
	});
});
