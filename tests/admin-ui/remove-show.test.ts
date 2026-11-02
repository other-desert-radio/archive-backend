import { expect, test } from "bun:test";
import { removeShow } from "../../src/admin-ui/loaders/remove-show.js";

test("deletes the selected Show through the authenticated API", async () => {
	const result = await removeShow({ id: 42 }, async (url, init) => {
		expect(url).toBe("/api/admin/remove-show");
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({ id: 42 });
		return Response.json({ id: 42 });
	});
	expect(result).toEqual({ id: 42 });
});

test("surfaces deletion failures for retry", async () => {
	await expect(
		removeShow({ id: 42 }, async () =>
			Response.json({ error: "Internal Server Error" }, { status: 500 }),
		),
	).rejects.toThrow("deleted");
});
