import { expect } from "@playwright/test";
import sharp from "sharp";
import { test } from "./auth-fixtures.js";

for (const width of [1280, 390, 320]) {
	test(`new show has only upload metadata at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#shows");
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
		await expect(form).toBeVisible();
		await page.locator("#show-title").fill("Upload draft");
		await page.locator("#show-date").fill("2026-10-26");
		const description = form.getByRole("textbox", {
			name: "description",
			exact: true,
		});
		await expect(description).toHaveAttribute("maxlength", "1000");
		await description.fill("A show description\nSecond line");
		await form
			.getByRole("combobox", { name: "tags", exact: true })
			.fill("House");
		for (const id of ["duration", "image-small", "image-large", "url"]) {
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
		await expect(description).toHaveValue("A show description\nSecond line");
		await page.screenshot({ path: `/tmp/show-description-${width}.png` });
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await page
			.getByRole("button", { name: "Discard changes", exact: true })
			.click();
		await expect(form).toBeHidden();
	});
}

for (const width of [1280, 390, 320]) {
	test(`Mixcloud title generation and override at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.route("**/api/admin/djs", (route) =>
			route.fulfill({
				json: [
					{ id: 1, title: "Justin Paszul", tags: [], shows: [] },
					{ id: 2, title: "Guest", tags: [], shows: [] },
				],
			}),
		);
		await page.goto("/admin/#shows");
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
		const output = form.getByRole("textbox", {
			name: "Mixcloud title",
			exact: true,
		});
		await expect(output).toHaveCount(0);
		await page.locator("#show-title").fill("Constant Coverage #2");
		await expect(output).toHaveCSS("border-bottom-color", "rgb(153, 153, 153)");
		await expect(output).toHaveCSS("border-top-width", "0px");
		await expect(output).toHaveCSS("border-left-width", "0px");
		await expect(output).toHaveCSS("border-right-width", "0px");
		await expect(
			form.getByText(
				"Title to be sent to Mixcloud. This is auto generated using the existing format. Click to edit",
				{ exact: true },
			),
		).toBeVisible();
		await page.locator("#show-title").fill("Constant Coverage #2");
		await expect(output).toHaveValue("Constant Coverage #2");
		await page.locator("#show-date").fill("2026-10-19");
		const search = form.getByRole("combobox", { name: "Search DJs" });
		await search.fill("Justin");
		await form
			.getByRole("option", { name: "Justin Paszul", exact: true })
			.click();
		await expect(output).toHaveValue(
			"Justin Paszul - Constant Coverage #2, October 19, 2026",
		);
		await search.fill("Guest");
		await form.getByRole("option", { name: "Guest", exact: true }).click();
		await expect(output).toHaveValue(
			"Justin Paszul + Guest - Constant Coverage #2, October 19, 2026",
		);
		await page.locator("#show-title").fill("Live");
		await page.locator("#show-title").pressSequentially(" typing");
		await expect(output).toHaveValue(
			"Justin Paszul + Guest - Live typing, October 19, 2026",
		);
		await output.fill("Custom upload title");
		await expect(output).toHaveCSS("border-color", "rgb(0, 0, 0)");
		await page.locator("#show-title").fill("Changed");
		await page
			.getByRole("button", { name: "existing show", exact: true })
			.click();
		await page.getByRole("button", { name: "new show", exact: true }).click();
		await expect(output).toHaveValue("Custom upload title");
		await form
			.getByRole("button", { name: "Reset to generated title" })
			.focus();
		await page.keyboard.press("Enter");
		await expect(output).toHaveValue(
			"Justin Paszul + Guest - Changed, October 19, 2026",
		);
		await page.locator("#show-date").fill("2026-01-01");
		await expect(output).toHaveValue(
			"Justin Paszul + Guest - Changed, January 1, 2026",
		);
		await output.scrollIntoViewIfNeeded();
		await page.screenshot({ path: `/tmp/mixcloud-title-${width}.png` });
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
		text: "Signed in as ODR",
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
		const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
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
		const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
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

test("Upload Show requires every field except description and tags", async ({
	page,
}) => {
	await page.route("**/api/admin/mixcloud/status", (route) =>
		route.fulfill({
			json: {
				configured: true,
				connected: true,
				account: { key: "/odr/", displayName: "ODR" },
			},
		}),
	);
	await page.route("**/api/admin/djs", (route) =>
		route.fulfill({ json: [{ id: 1, title: "DJ", tags: [], shows: [] }] }),
	);
	await page.goto("/admin/#shows");
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Upload Show", exact: true });
	const submit = form.locator('button[type="submit"]');
	await page.locator("#show-title").fill("Show");
	await page.locator("#show-date").fill("2026-10-19");
	await form.getByRole("combobox", { name: "Search DJs" }).fill("DJ");
	await form.getByRole("option", { name: "DJ", exact: true }).click();
	await page.locator("#show-mp3").setInputFiles({
		name: "show.mp3",
		mimeType: "audio/mpeg",
		buffer: Buffer.from("audio"),
	});
	await expect(submit).toBeDisabled();
	const buffer = await sharp({
		create: { width: 400, height: 400, channels: 3, background: "red" },
	})
		.png()
		.toBuffer();
	await page
		.locator("#show-image")
		.setInputFiles({ name: "cover.png", mimeType: "image/png", buffer });
	await page.getByRole("button", { name: "Use image", exact: true }).click();
	await expect(submit).toBeEnabled();
	for (const [id, value] of [
		["title", "Show"],
		["date", "2026-10-19"],
		["mixcloud-title", "DJ - Show"],
	]) {
		await page.locator(`#show-${id}`).fill("");
		await expect(submit).toBeDisabled();
		await page.locator(`#show-${id}`).fill(value);
		await expect(submit).toBeEnabled();
	}
	await form.getByRole("button", { name: "Remove DJ", exact: true }).click();
	await expect(submit).toBeDisabled();
	await form.getByRole("combobox", { name: "Search DJs" }).fill("DJ");
	await form.getByRole("option", { name: "DJ", exact: true }).click();
	await expect(submit).toBeEnabled();
	await form.getByRole("button", { name: "Remove MP3", exact: true }).click();
	await expect(submit).toBeDisabled();
});
