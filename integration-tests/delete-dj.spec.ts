import { expect } from "@playwright/test";
import { createDJ, rowFor } from "./dj-fixtures.js";
import { showRequest, test } from "./show-fixtures.js";

test("DJ deletion blocks linked Shows, permits unlinking, and preserves shared Shows and tags", async ({
	request,
	dj,
	show,
}) => {
	const impact = await request.get(`/api/admin/djs/${dj.id}/delete-impact`);
	expect(impact.status()).toBe(200);
	expect(await impact.json()).toEqual({
		dj: { id: dj.id, title: dj.title },
		shows: [{ id: show.id, title: show.title }],
	});
	expect(
		(
			await request.post("/api/admin/remove-dj", { data: { id: dj.id } })
		).status(),
	).toBe(409);
	const other = await createDJ(request, false);
	const updated = await request.post("/api/admin/modify-show", {
		data: { ...showRequest(show), djs: [other.id], tags: [show.title] },
	});
	expect(updated.status(), await updated.text()).toBe(200);
	const removed = await request.post("/api/admin/remove-dj", {
		data: { id: dj.id },
	});
	expect(removed.status(), await removed.text()).toBe(200);
	expect(await removed.json()).toEqual({ id: dj.id });
	expect(
		(
			await request.post("/api/admin/remove-dj", { data: { id: dj.id } })
		).status(),
	).toBe(404);
	const shows = await request.get("/api/admin/shows");
	expect(
		(await shows.json()).find((entry: { id: number }) => entry.id === show.id),
	).toMatchObject({ djs: [other.id], tags: show.tags });
	const tags = await request.get("/api/admin/tags");
	expect((await tags.json()).map((entry: { id: number }) => entry.id)).toEqual(
		expect.arrayContaining(dj.directTags),
	);
});

for (const width of [1280, 390, 320]) {
	test(`DJ blocked confirmation and successful deletion at ${width}px`, async ({
		page,
		request,
		dj,
		show,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#djs");
		await page.getByRole("button", { name: "table", exact: true }).click();
		const opener = rowFor(page, dj.id).getByRole("button", {
			name: "Delete",
			exact: true,
		});
		await opener.click();
		const dialog = page.getByRole("alertdialog", {
			name: "Delete DJ?",
			exact: true,
		});
		const remove = dialog.getByRole("button", {
			name: "Delete DJ",
			exact: true,
		});
		await expect(dialog.getByText(show.title, { exact: true })).toBeVisible();
		await expect(remove).toBeDisabled();
		await expect(remove).toHaveCSS("color", "rgb(136, 136, 136)");
		await expect(dialog.getByRole("link")).toHaveCount(0);
		await expect(
			dialog.getByRole("button", { name: "Cancel", exact: true }),
		).toBeFocused();
		await page.screenshot({ path: `/tmp/delete-dj-blocked-${width}.png` });
		await page.keyboard.press("Escape");
		await expect(opener).toBeFocused();
		expect(
			(
				await request.post("/api/admin/remove-show", { data: { id: show.id } })
			).status(),
		).toBe(200);
		await page.getByRole("button", { name: "grid", exact: true }).click();
		await page
			.getByRole("button", { name: `Delete ${dj.title}`, exact: true })
			.click();
		await expect(remove).toBeEnabled();
		await page.screenshot({ path: `/tmp/delete-dj-ready-${width}.png` });
		await remove.click();
		await expect(dialog).toBeHidden();
		const toast = page
			.getByRole("status")
			.filter({ hasText: "Successfully deleted DJ." });
		await expect(toast).toContainText(dj.title);
		await page.screenshot({ path: `/tmp/delete-dj-toast-${width}.png` });
		await page.getByRole("button", { name: "Dismiss notification" }).click();
		await expect(toast).toBeHidden();
	});
}

test("DJ preview retry, stale links, pending lock, and committed refresh failure", async ({
	page,
	dj,
}) => {
	await page.goto("/admin/#djs");
	await page.getByRole("button", { name: "table", exact: true }).click();
	let previews = 0;
	await page.route(`**/api/admin/djs/${dj.id}/delete-impact`, (route) => {
		previews++;
		return previews === 1
			? route.fulfill({ status: 500, json: { error: "Preview failed" } })
			: route.fulfill({
					json: {
						dj: { id: dj.id, title: dj.title },
						shows:
							previews === 3
								? [{ id: 999999, title: "Newly linked Show" }]
								: [],
					},
				});
	});
	await rowFor(page, dj.id)
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	const dialog = page.getByRole("alertdialog", {
		name: "Delete DJ?",
		exact: true,
	});
	const remove = dialog.getByRole("button", { name: "Delete DJ", exact: true });
	await expect(dialog.getByRole("alert")).toBeVisible();
	await expect(remove).toBeDisabled();
	await dialog.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(remove).toBeEnabled();
	let attempts = 0;
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/admin/remove-dj", async (route) => {
		attempts++;
		if (attempts === 1) {
			await gate;
			await route.fulfill({
				status: 409,
				json: { error: "Linked Shows remain" },
			});
		} else await route.fulfill({ json: { id: dj.id } });
	});
	await remove.click();
	await expect(
		dialog.getByRole("button", { name: "Deleting…" }),
	).toBeDisabled();
	await page.keyboard.press("Escape");
	await expect(dialog).toBeVisible();
	release();
	await expect(
		dialog.getByText("Newly linked Show", { exact: true }),
	).toBeVisible();
	await expect(remove).toBeDisabled();
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await rowFor(page, dj.id)
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(remove).toBeEnabled();
	await page.route("**/api/admin/djs", (route) =>
		route.fulfill({ status: 500 }),
	);
	await remove.click();
	await expect(dialog).toBeHidden();
	await expect(
		page.getByRole("status").filter({ hasText: "Successfully deleted DJ." }),
	).toBeVisible();
	await expect(rowFor(page, dj.id)).toHaveCount(0);
	expect(attempts).toBe(2);
});

test("long linked-Show list scrolls on a narrow phone", async ({
	page,
	dj,
}) => {
	await page.setViewportSize({ width: 320, height: 900 });
	await page.route(`**/api/admin/djs/${dj.id}/delete-impact`, (route) =>
		route.fulfill({
			json: {
				dj: { id: dj.id, title: dj.title },
				shows: Array.from({ length: 30 }, (_, id) => ({
					id,
					title: `Associated Show ${id} with a long descriptive title`,
				})),
			},
		}),
	);
	await page.goto("/admin/#djs");
	await page.getByRole("button", { name: "table", exact: true }).click();
	await rowFor(page, dj.id)
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	const dialog = page.getByRole("alertdialog", {
		name: "Delete DJ?",
		exact: true,
	});
	const list = dialog.getByRole("list");
	await expect(dialog.getByRole("listitem")).toHaveCount(30);
	expect(
		await list.evaluate(
			(element) => element.scrollHeight > element.clientHeight,
		),
	).toBe(true);
	await list.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	await expect(
		dialog.getByText("Associated Show 29 with a long descriptive title", {
			exact: true,
		}),
	).toBeInViewport();
	await expect(
		dialog.getByRole("button", { name: "Cancel", exact: true }),
	).toBeInViewport();
	await expect(
		dialog.getByRole("button", { name: "Delete DJ", exact: true }),
	).toBeDisabled();
	await page.screenshot({ path: "/tmp/delete-dj-long-list-320.png" });
});
