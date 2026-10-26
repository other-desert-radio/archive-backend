import { expect } from "@playwright/test";
import sharp from "sharp";
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

for (const width of [1280, 390, 320]) {
	test(`new show square image crop and removal at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#shows");
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		const form = page.getByRole("dialog", { name: "New Show", exact: true });
		const buffer = await sharp({
			create: { width: 600, height: 400, channels: 3, background: "red" },
		})
			.png()
			.toBuffer();
		const select = () =>
			page
				.locator("#show-image")
				.setInputFiles({ name: "cover.png", mimeType: "image/png", buffer });
		await select();
		const crop = page.getByRole("dialog", { name: "Crop image", exact: true });
		await expect(crop).toBeVisible();
		await crop.getByRole("button", { name: "Rotate right" }).click();
		await crop.getByRole("slider", { name: "Zoom" }).fill("1.5");
		await crop.getByRole("button", { name: "Use image" }).click();
		await expect(crop).toBeHidden();
		const preview = form.getByAltText("Selected preview");
		await expect(preview).toBeVisible();
		const dimensions = await preview.evaluate(async (img: HTMLImageElement) => {
			await img.decode();
			return [img.naturalWidth, img.naturalHeight];
		});
		expect(dimensions).toEqual([1200, 1200]);
		await expect(
			form.getByRole("button", { name: "cover.webp", exact: true }),
		).toBeVisible();
		await page.screenshot({ path: `/tmp/show-image-${width}.png` });
		await select();
		await expect(crop).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(crop).toBeHidden();
		await expect(preview).toBeVisible();
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await page
			.getByRole("button", { name: "Keep editing", exact: true })
			.click();
		await form
			.getByRole("button", { name: "Remove image", exact: true })
			.click();
		await expect(preview).toHaveCount(0);
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(form).toBeHidden();
	});
}
