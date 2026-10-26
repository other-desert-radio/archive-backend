import { expect } from "@playwright/test";
import { test } from "./auth-fixtures.js";

test.beforeEach(async ({ page }) => {
	for (const resource of ["shows", "djs", "tags"]) {
		await page.route(`**/api/admin/${resource}`, (route) =>
			route.fulfill({
				json:
					resource === "djs"
						? [
								{
									id: 1,
									title: "Mode test DJ",
									tags: [],
									directTags: [],
									shows: [],
								},
							]
						: [],
			}),
		);
	}
	await page.goto("/admin/#shows");
});

for (const width of [1280, 390, 320]) {
	test(`show modes retain fields, reset, and show tooltips at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		const modal = page.getByRole("dialog", {
			name: /^(New Show|Import Show)$/,
		});
		const picker = modal.getByRole("group", { name: "Show mode" });
		const newShow = picker.getByRole("button", {
			name: "new show",
			exact: true,
		});
		const existingShow = picker.getByRole("button", {
			name: "existing show",
			exact: true,
		});
		await expect(newShow).toHaveAttribute("aria-pressed", "true");
		await existingShow.click();
		await expect(
			modal.getByRole("button", { name: "Submit", exact: true }),
		).toBeDisabled();
		await page.locator("#show-title").fill("Retained draft");
		await newShow.click();
		await expect(page.locator("#show-title")).toHaveValue("Retained draft");
		await existingShow.click();
		await expect(page.locator("#show-title")).toHaveValue("Retained draft");
		await expect(
			modal.getByRole("heading", { name: "Import Show" }),
		).toBeVisible();
		await expect(newShow).toHaveAttribute(
			"title",
			"This is for a show that doesn't yet exist on Mixcloud. Submitting here will upload to Mixcloud.",
		);
		await expect(existingShow).toHaveAttribute(
			"title",
			"This is for a show that already exists on Mixcloud. You're bringing it over.",
		);
		await expect(existingShow).toHaveCSS("color", "rgb(255, 255, 255)");
		await expect(newShow).toHaveCSS("color", "rgb(153, 153, 153)");
		await newShow.focus();
		await newShow.press("Enter");
		await expect(
			modal.getByRole("heading", { name: "New Show" }),
		).toBeVisible();
		await expect(newShow).toHaveCSS("color", "rgb(255, 255, 255)");
		await expect(existingShow).toHaveCSS("color", "rgb(153, 153, 153)");
		for (const button of [newShow, existingShow]) {
			await expect(button).toHaveCSS("border-top-width", "1px");
		}
		await expect(newShow).toHaveCSS("background-color", "rgb(0, 0, 0)");
		await expect(existingShow).toHaveCSS(
			"background-color",
			"rgb(255, 255, 255)",
		);
		await expect(newShow).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
		await expect(existingShow).toHaveCSS(
			"border-top-color",
			"rgb(153, 153, 153)",
		);
		const selectedBounds = await newShow.boundingBox();
		const unselectedBounds = await existingShow.boundingBox();
		expect(selectedBounds?.width).toBe(unselectedBounds?.width);
		expect(selectedBounds?.height).toBe(unselectedBounds?.height);
		await page.evaluate(() => document.fonts.ready);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth),
		).toBe(width);
		await page.locator("#show-title").fill("");
		await modal.getByRole("button", { name: "Close", exact: true }).click();
		await expect(modal).toBeHidden();
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		await expect(newShow).toHaveAttribute("aria-pressed", "true");
	});
}

for (const mode of ["new show", "existing show"]) {
	test(`${mode} keeps the archive payload and disables switching while submitting`, async ({
		page,
	}) => {
		let release: () => void = () => {};
		const pending = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route("**/api/admin/create-show", async (route) => {
			await pending;
			await route.fulfill({
				status: 500,
				json: { error: "Test save failure" },
			});
		});
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		const modal = page.getByRole("dialog", {
			name: /^(New Show|Import Show)$/,
		});
		await modal.getByRole("button", { name: mode, exact: true }).click();
		for (const [field, value] of Object.entries({
			title: "Test broadcast",
			date: "2026-10-26",
			duration: "3600",
			"image-small": "https://example.test/small.jpg",
			"image-large": "https://example.test/large.jpg",
			url: "https://example.test/show",
		}))
			await page.locator(`#show-${field}`).fill(value);
		await modal
			.getByRole("combobox", { name: "Search DJs" })
			.fill("Mode test DJ");
		await page
			.getByRole("option", { name: "Mode test DJ", exact: true })
			.click();
		const request = page.waitForRequest("**/api/admin/create-show");
		await modal.getByRole("button", { name: "Submit", exact: true }).click();
		expect((await request).postDataJSON()).toEqual({
			title: "Test broadcast",
			date: "2026-10-26",
			duration: 3600,
			image_small: "https://example.test/small.jpg",
			image_large: "https://example.test/large.jpg",
			url: "https://example.test/show",
			djs: [1],
		});
		await expect(
			modal.getByRole("button", { name: "new show", exact: true }),
		).toBeDisabled();
		await expect(
			modal.getByRole("button", { name: "existing show", exact: true }),
		).toBeDisabled();
		release();
		await expect(modal.getByRole("alert")).toBeVisible();
		await expect(page.locator("#show-title")).toHaveValue("Test broadcast");
		await expect(
			modal.getByRole("button", { name: mode, exact: true }),
		).toBeEnabled();
	});
}
