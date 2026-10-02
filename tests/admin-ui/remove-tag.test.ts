import { expect, test } from "bun:test";
import {
	loadTagDeleteImpact,
	removeTag,
} from "../../src/admin-ui/loaders/remove-tag.js";

test("loads impact using the tag ID and posts only the deletion contract", async () => {
	const impact = { tag: { id: 7, title: "Ambient" }, shows: [], djs: [] };
	expect(
		await loadTagDeleteImpact(7, async (url, options) => {
			expect(url).toBe("/api/admin/tags/7/delete-impact");
			expect(options).toBeUndefined();
			return Response.json(impact);
		}),
	).toEqual(impact);
	expect(
		await removeTag({ id: 7 }, async (url, options) => {
			expect(url).toBe("/api/admin/remove-tag");
			expect(options?.method).toBe("POST");
			expect(options?.headers).toEqual({ "content-type": "application/json" });
			expect(JSON.parse(options?.body as string)).toEqual({ id: 7 });
			return Response.json({ id: 7 });
		}),
	).toEqual({ id: 7 });
});

test("preview and deletion failures retain useful server and HTTP details", async () => {
	await expect(
		loadTagDeleteImpact(7, async () =>
			Response.json({ error: "Not Found" }, { status: 404 }),
		),
	).rejects.toThrow("Not Found");
	await expect(
		removeTag(
			{ id: 7 },
			async () => new Response("Bad gateway", { status: 502 }),
		),
	).rejects.toThrow("HTTP 502");
});
