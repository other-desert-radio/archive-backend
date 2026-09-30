import { describe, expect, test } from "bun:test";
import { modifyTag } from "../../src/admin-ui/loaders/modify-tag.js";

const payload = {
	edit_type: "full_edit" as const,
	id: 1,
	title: "Ambient",
	color: "#123456",
	mixcloud_key: "",
	mixcloud_url: "",
};
describe("modifyTag loader", () => {
	test("sends only the keyed review request", async () => {
		const review = { edit_type: "review" as const, id: 1, reviewed: false };
		const saved = {
			id: 1,
			title: "Ambient",
			color: "#123456",
			reviewed: false,
		};
		expect(
			await modifyTag(review, async (_input, init) => {
				expect(JSON.parse(init?.body as string)).toEqual(review);
				return new Response(JSON.stringify(saved));
			}),
		).toEqual(saved);
	});
	test("posts the shared replacement contract and returns the saved Tag", async () => {
		const saved = {
			id: 1,
			title: payload.title,
			color: payload.color,
			reviewed: true,
		};
		expect(
			await modifyTag(payload, async (input, init) => {
				expect(input).toBe("/api/admin/modify-tag");
				expect(init?.method).toBe("POST");
				expect(init?.headers).toEqual({ "content-type": "application/json" });
				expect(JSON.parse(init?.body as string)).toEqual(payload);
				return new Response(JSON.stringify(saved));
			}),
		).toEqual(saved);
	});
	test("includes actionable server failures and HTTP status", async () => {
		await expect(
			modifyTag(
				payload,
				async () =>
					new Response(
						'{"error":"Another tag already uses this title. Choose a different title."}',
						{ status: 400 },
					),
			),
		).rejects.toThrow("Choose a different title.");
		await expect(
			modifyTag(
				payload,
				async () => new Response("Bad gateway", { status: 502 }),
			),
		).rejects.toThrow("HTTP 502");
	});
});
