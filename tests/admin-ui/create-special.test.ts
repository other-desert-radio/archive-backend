import { describe, expect, test } from "bun:test";
import { createSpecial } from "../../src/admin-ui/loaders/create-special.js";

const payload = {
	title: "Ambient",
};
describe("createSpecial loader", () => {
	test("posts the shared creation contract and returns the created Special", async () => {
		const saved = {
			id: 1,
			title: payload.title,
			createdAt: "2026-01-01T00:00:00.000Z",
		};
		expect(
			await createSpecial(payload, async (input, init) => {
				expect(input).toBe("/api/admin/create-special");
				expect(init?.method).toBe("POST");
				expect(init?.headers).toEqual({ "content-type": "application/json" });
				expect(JSON.parse(init?.body as string)).toEqual(payload);
				return new Response(JSON.stringify(saved));
			}),
		).toEqual(saved);
	});
	test("includes actionable server failures and HTTP status", async () => {
		await expect(
			createSpecial(
				payload,
				async () =>
					new Response(
						'{"error":"Another special already uses this title. Choose a different title."}',
						{ status: 400 },
					),
			),
		).rejects.toThrow("Choose a different title.");
		await expect(
			createSpecial(
				payload,
				async () => new Response("Bad gateway", { status: 502 }),
			),
		).rejects.toThrow("HTTP 502");
	});
});
