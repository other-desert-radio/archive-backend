import { expect, test } from "bun:test";
import {
	loadSpecialDeleteImpact,
	removeSpecial,
	SpecialDeleteConflictError,
} from "../../src/admin-ui/loaders/remove-special.js";

test("loads the selected Special's blocking Shows", async () => {
	const impact = {
		special: { id: 42, title: "Special" },
		shows: [{ id: 7, title: "Show" }],
	};
	expect(
		await loadSpecialDeleteImpact(42, async (url) => {
			expect(url).toBe("/api/admin/specials/42/delete-impact");
			return Response.json(impact);
		}),
	).toEqual(impact);
});

test("deletes the selected Special through the authenticated API", async () => {
	expect(
		await removeSpecial({ id: 42 }, async (url, init) => {
			expect(url).toBe("/api/admin/remove-special");
			expect(init?.method).toBe("POST");
			expect(JSON.parse(String(init?.body))).toEqual({ id: 42 });
			return Response.json({ id: 42 });
		}),
	).toEqual({ id: 42 });
});

test("distinguishes an association conflict so the modal reloads its Show list", async () => {
	await expect(
		removeSpecial({ id: 42 }, async () =>
			Response.json(
				{ error: "Remove associated Shows first." },
				{ status: 409 },
			),
		),
	).rejects.toBeInstanceOf(SpecialDeleteConflictError);
});

test("surfaces preview and deletion failures for retry", async () => {
	const failure = async () =>
		Response.json({ error: "Internal Server Error" }, { status: 500 });
	await expect(loadSpecialDeleteImpact(42, failure)).rejects.toThrow("loaded");
	await expect(removeSpecial({ id: 42 }, failure)).rejects.toThrow("deleted");
});

test("surfaces the deletion preview error detail in the dialog message", async () => {
	await expect(
		loadSpecialDeleteImpact(42, async () =>
			Response.json(
				{ error: "Unable to load Special deletion preview. offline" },
				{ status: 500 },
			),
		),
	).rejects.toThrow("Unable to load Special deletion preview. offline");
});
