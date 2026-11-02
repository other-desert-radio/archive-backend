import { expect } from "@playwright/test";
import { showRow, test } from "./show-fixtures.js";

for (const width of [1280, 390, 320]) {
	test(`Show deletion confirmation, retry and committed reload failure at ${width}px`, async ({
		page,
		show,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#shows");
		await page.getByRole("button", { name: "table", exact: true }).click();
		const opener = showRow(page, show.id).getByRole("button", {
			name: "Delete",
			exact: true,
		});
		await opener.click();
		const dialog = page.getByRole("alertdialog", { name: "Delete Show?" });
		await expect(
			dialog.getByRole("button", { name: "Cancel", exact: true }),
		).toBeFocused();
		await page.screenshot({ path: `/tmp/delete-show-${width}.png` });
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
		await page.getByRole("button", { name: "grid", exact: true }).click();
		await page
			.getByRole("button", { name: `Delete ${show.title}`, exact: true })
			.click();
		let attempts = 0;
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route("**/api/admin/remove-show", async (route) => {
			attempts++;
			if (attempts === 1) {
				await gate;
				await route.fulfill({
					status: 500,
					json: { error: "Internal Server Error" },
				});
			} else await route.fulfill({ json: { id: show.id } });
		});
		await dialog
			.getByRole("button", { name: "Delete Show", exact: true })
			.click();
		await expect(
			dialog.getByRole("button", { name: "Deleting…" }),
		).toBeDisabled();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeVisible();
		release();
		await expect(dialog.getByRole("alert")).toBeVisible();
		await page.route("**/api/admin/shows", (route) =>
			route.fulfill({ status: 500 }),
		);
		await dialog
			.getByRole("button", { name: "Delete Show", exact: true })
			.click();
		await expect(dialog).toBeHidden();
		await expect(
			page.getByRole("button", { name: `Delete ${show.title}`, exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByText(
				"Show changes saved, but the latest resource lists could not be loaded.",
			),
		).toBeVisible();
		expect(attempts).toBe(2);
	});
}
