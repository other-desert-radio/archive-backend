import { randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { showRequest, test } from "./show-fixtures.js";

for (const width of [1280, 390, 320]) {
	test(`specials creation, search, views and guarded deletion at ${width}px`, async ({
		page,
		request,
		show,
	}) => {
		const title = `Special ${randomUUID()}`;
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#specials");
		await expect(
			page.getByRole("link", { name: "⤷ specials" }),
		).toHaveAttribute("aria-current", "page");
		await page.getByRole("button", { name: "+ special", exact: true }).click();
		const form = page.getByRole("dialog", {
			name: "Create special",
			exact: true,
		});
		await expect(
			form.getByRole("button", { name: "Create special", exact: true }),
		).toBeDisabled();
		await form
			.getByRole("textbox", { name: "name", exact: true })
			.fill(`  ${title}  `);
		await page.screenshot({ path: `/tmp/specials-create-${width}.png` });
		await form
			.getByRole("button", { name: "Create special", exact: true })
			.click();
		await expect(form).toBeHidden();
		const list = await request.get("/api/admin/specials");
		const special = (await list.json()).find(
			(row: { title: string }) => row.title === title,
		);
		expect(special).toBeDefined();
		try {
			const assigned = await request.post("/api/admin/modify-show", {
				data: { ...showRequest(show), tags: [], special_id: special.id },
			});
			expect(assigned.status(), await assigned.text()).toBe(200);
			await page.reload();
			await page
				.getByRole("textbox", { name: "Search Specials" })
				.fill(show.title);
			const row = page.getByRole("row").filter({ hasText: title });
			await expect(row).toContainText(show.title);
			await expect(
				row.getByRole("button", { name: "Edit", exact: true }),
			).toBeDisabled();
			await page.screenshot({ path: `/tmp/specials-table-${width}.png` });
			await row.getByRole("button", { name: "Delete", exact: true }).click();
			const dialog = page.getByRole("alertdialog", {
				name: "Delete Special?",
				exact: true,
			});
			await expect(dialog.getByText(show.title, { exact: true })).toBeVisible();
			await expect(
				dialog.getByRole("button", { name: "Delete Special", exact: true }),
			).toBeDisabled();
			await expect(
				dialog.getByRole("button", { name: "Cancel", exact: true }),
			).toBeFocused();
			await page.screenshot({ path: `/tmp/specials-blocked-${width}.png` });
			expect(
				(
					await request.post("/api/admin/remove-special", {
						data: { id: special.id },
					})
				).status(),
			).toBe(409);
			await page.keyboard.press("Escape");
			await expect(
				row.getByRole("button", { name: "Delete", exact: true }),
			).toBeFocused();
			const unlinked = await request.post("/api/admin/modify-show", {
				data: { ...showRequest(show), tags: [], special_id: null },
			});
			expect(unlinked.status(), await unlinked.text()).toBe(200);
			await page.getByRole("textbox", { name: "Search Specials" }).fill(title);
			await page.getByRole("button", { name: "grid", exact: true }).click();
			await page.reload();
			const card = page.getByRole("article", {
				name: `Special ${title}`,
				exact: true,
			});
			await expect(card).toBeVisible();
			await expect(card).not.toContainText(show.title);
			await expect(
				card.getByRole("button", { name: `Edit ${title}`, exact: true }),
			).toBeDisabled();
			await page.screenshot({ path: `/tmp/specials-grid-${width}.png` });
			await card
				.getByRole("button", { name: `Delete ${title}`, exact: true })
				.click();
			await expect(
				dialog.getByRole("button", { name: "Delete Special", exact: true }),
			).toBeEnabled();
			await dialog
				.getByRole("button", { name: "Delete Special", exact: true })
				.click();
			await expect(dialog).toBeHidden();
			await expect(card).toHaveCount(0);
			await expect(
				page.getByRole("status").filter({ hasText: title }),
			).toBeVisible();
		} finally {
			await request.post("/api/admin/modify-show", {
				data: { ...showRequest(show), tags: [], special_id: null },
			});
			await request.post("/api/admin/remove-special", {
				data: { id: special.id },
			});
		}
	});
}

test("special forms retain failed drafts and deletion reloads after a concurrent association", async ({
	page,
	request,
	show,
}) => {
	const title = `Retry special ${randomUUID()}`;
	await page.goto("/admin/#specials");
	await page.getByRole("button", { name: "+ special", exact: true }).click();
	const form = page.getByRole("dialog", {
		name: "Create special",
		exact: true,
	});
	await form.getByRole("textbox", { name: "name", exact: true }).fill(title);
	await page.route(
		"**/api/admin/create-special",
		(route) =>
			route.fulfill({ status: 500, json: { error: "Please retry creation." } }),
		{ times: 1 },
	);
	await form
		.getByRole("button", { name: "Create special", exact: true })
		.click();
	await expect(form.getByRole("alert")).toContainText("Please retry creation.");
	await expect(
		form.getByRole("textbox", { name: "name", exact: true }),
	).toHaveValue(title);
	await form
		.getByRole("button", { name: "Create special", exact: true })
		.click();
	await expect(form).toBeHidden();
	const special = (
		await (await request.get("/api/admin/specials")).json()
	).find((row: { title: string }) => row.title === title);
	try {
		await page.getByRole("button", { name: "table", exact: true }).click();
		await page.getByRole("textbox", { name: "Search Specials" }).fill(title);
		const row = page.getByRole("row").filter({ hasText: title });
		await page.route(
			`**/api/admin/specials/${special.id}/delete-impact`,
			(route) =>
				route.fulfill({ status: 500, json: { error: "Preview unavailable." } }),
			{ times: 1 },
		);
		await row.getByRole("button", { name: "Delete", exact: true }).click();
		const dialog = page.getByRole("alertdialog", {
			name: "Delete Special?",
			exact: true,
		});
		const remove = dialog.getByRole("button", {
			name: "Delete Special",
			exact: true,
		});
		await expect(dialog.getByRole("alert")).toContainText(
			"Preview unavailable.",
		);
		await expect(remove).toBeDisabled();
		await dialog.getByRole("button", { name: "Retry", exact: true }).click();
		await expect(remove).toBeEnabled();
		const assigned = await request.post("/api/admin/modify-show", {
			data: { ...showRequest(show), tags: [], special_id: special.id },
		});
		expect(assigned.status(), await assigned.text()).toBe(200);
		await remove.click();
		await expect(dialog.getByText(show.title, { exact: true })).toBeVisible();
		await expect(remove).toBeDisabled();
		await expect(dialog.getByRole("alert")).toContainText(
			"Remove this Special",
		);
		await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	} finally {
		await request.post("/api/admin/modify-show", {
			data: { ...showRequest(show), tags: [], special_id: null },
		});
		await request.post("/api/admin/remove-special", {
			data: { id: special.id },
		});
	}
});
