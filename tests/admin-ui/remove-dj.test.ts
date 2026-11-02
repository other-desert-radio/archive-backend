import { expect, test } from "bun:test";
import {
	DJDeleteConflictError,
	loadDJDeleteImpact,
	removeDJ,
} from "../../src/admin-ui/loaders/remove-dj.js";

test("loads the selected DJ's blocking Shows", async () => {
	const impact = {
		dj: { id: 42, title: "DJ" },
		shows: [{ id: 7, title: "Show" }],
	};
	expect(
		await loadDJDeleteImpact(42, async (url) => {
			expect(url).toBe("/api/admin/djs/42/delete-impact");
			return Response.json(impact);
		}),
	).toEqual(impact);
});

test("deletes the selected DJ through the authenticated API", async () => {
	expect(
		await removeDJ({ id: 42 }, async (url, init) => {
			expect(url).toBe("/api/admin/remove-dj");
			expect(init?.method).toBe("POST");
			expect(JSON.parse(String(init?.body))).toEqual({ id: 42 });
			return Response.json({ id: 42 });
		}),
	).toEqual({ id: 42 });
});

test("distinguishes an association conflict so the modal reloads its Show list", async () => {
	await expect(
		removeDJ({ id: 42 }, async () =>
			Response.json(
				{ error: "Remove associated Shows first." },
				{ status: 409 },
			),
		),
	).rejects.toBeInstanceOf(DJDeleteConflictError);
});

test("surfaces preview and deletion failures for retry", async () => {
	const failure = async () =>
		Response.json({ error: "Internal Server Error" }, { status: 500 });
	await expect(loadDJDeleteImpact(42, failure)).rejects.toThrow("loaded");
	await expect(removeDJ({ id: 42 }, failure)).rejects.toThrow("deleted");
});
