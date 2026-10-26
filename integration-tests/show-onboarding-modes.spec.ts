import { expect } from "@playwright/test";
import { test } from "./auth-fixtures.js";

for (const width of [1280, 390, 320]) {
	test(`new show has only upload metadata at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#shows");
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		const form = page.getByRole("dialog", { name: "New Show", exact: true });
		await expect(form).toBeVisible();
		await page.locator("#show-title").fill("Upload draft");
		await page.locator("#show-date").fill("2026-10-26");
		await form
			.getByRole("combobox", { name: "tags", exact: true })
			.fill("House");
		for (const id of ["duration", "image-small", "image-large", "url", "djs"]) {
			await expect(page.locator(`#show-${id}`)).toHaveCount(0);
		}
		await expect(form.locator('button[type="submit"]')).toBeDisabled();
		await expect(form).toContainText(
			"Upload validation only; Mixcloud upload is not connected yet.",
		);
		await page
			.getByRole("button", { name: "existing show", exact: true })
			.click();
		const existing = page.getByRole("dialog", {
			name: "Onboard Show",
			exact: true,
		});
		await expect(page.locator("#show-title")).toHaveValue("Upload draft");
		await expect(page.locator("#show-duration")).toBeVisible();
		await expect(
			existing.getByRole("combobox", { name: "Search DJs" }),
		).toBeVisible();
		await expect(existing.locator('button[type="submit"]')).toBeEnabled();
		await page.getByRole("button", { name: "new show", exact: true }).click();
		await expect(page.locator("#show-date")).toHaveValue("2026-10-26");
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await page
			.getByRole("button", { name: "Discard changes", exact: true })
			.click();
		await expect(form).toBeHidden();
	});
}

for (const { status, body, text } of [
	{
		status: 200,
		body: {
			configured: true,
			connected: true,
			account: { key: "/odr/", displayName: "ODR" },
		},
		text: "Signed in as ODR via Mixcloud",
	},
	{
		status: 200,
		body: { configured: true, connected: false },
		text: "Not signed in via Mixcloud.",
	},
	{
		status: 200,
		body: { configured: false, connected: false },
		text: "Mixcloud is not configured.",
	},
	{
		status: 500,
		body: { error: "Unavailable" },
		text: "Unable to check Mixcloud sign-in.",
	},
]) {
	test(`new show connection text: ${text}`, async ({ page }) => {
		await page.route("**/api/admin/mixcloud/status", (route) =>
			route.fulfill({ status, json: body }),
		);
		await page.goto("/admin/#shows");
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		const form = page.getByRole("dialog", { name: "New Show", exact: true });
		await expect(form.getByRole("status")).toHaveText(text);
		await page
			.getByRole("button", { name: "existing show", exact: true })
			.click();
		await expect(page.getByRole("dialog").getByRole("status")).toHaveCount(0);
	});
}
