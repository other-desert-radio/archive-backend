import { describe, expect, test } from "bun:test";
import { validateTags } from "../../src/admin-ui/loaders/validate-tags.js";

describe("validateTags loader", () => {
	test("posts tags to the admin validation endpoint", async () => {
		let input: string | URL | Request | undefined;
		let init: RequestInit | undefined;
		const result = await validateTags(
			["dance", "new tag"],
			async (requestInput, requestInit) => {
				input = requestInput;
				init = requestInit;
				return new Response(
					JSON.stringify({ valid: ["dance"], invalid: ["new tag"] }),
					{ status: 200 },
				);
			},
		);

		expect(input).toBe("/api/admin/validate-tags");
		expect(init?.method).toBe("POST");
		expect(new Headers(init?.headers).get("content-type")).toBe(
			"application/json",
		);
		expect(JSON.parse(init?.body as string)).toEqual({
			tags: ["dance", "new tag"],
		});
		expect(result).toEqual({ valid: ["dance"], invalid: ["new tag"] });
	});

	test("rejects an unsuccessful response", async () => {
		await expect(
			validateTags(
				["missing"],
				async () => new Response(null, { status: 500 }),
			),
		).rejects.toThrow("Unable to validate tags");
	});
});

test("resolves Mixcloud keys using the alternative request contract", async () => {
	const { resolveMixcloudTags } = await import(
		"../../src/admin-ui/loaders/validate-tags.js"
	);
	const expected = {
		valid: [
			{ key: "/ambient/", tag: { id: 1, title: "Ambient", color: "#aabbcc" } },
		],
		invalid: ["/missing/"],
	};
	const result = await resolveMixcloudTags(
		["/ambient/", "/missing/"],
		async (url, init) => {
			expect(url).toBe("/api/admin/validate-tags");
			expect(init?.method).toBe("POST");
			expect(JSON.parse(init?.body as string)).toEqual({
				mixcloud_keys: ["/ambient/", "/missing/"],
			});
			return Response.json(expected);
		},
	);
	expect(result).toEqual(expected);
	await expect(
		resolveMixcloudTags([], async () => new Response(null, { status: 500 })),
	).rejects.toThrow("Unable to resolve Mixcloud tags");
});
