import { expect, test } from "@playwright/test";
import sharp from "sharp";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
const djTitle = "Integration test DJ";

test.use({
	baseURL,
	httpCredentials: { username: "admin", password: "admin" },
});

test("replaces a DJ image and shows the cropped image preview before saving", async ({
	page,
}) => {
	test.setTimeout(15_000);
	await page.goto("/admin/#djs");
	await page
		.getByRole("row", { name: new RegExp(djTitle) })
		.getByRole("button", { name: "Edit" })
		.click();
	await page.getByRole("button", { name: "Replace" }).click();
	const image = await sharp({
		create: {
			width: 64,
			height: 64,
			channels: 4,
			background: { r: 30, g: 90, b: 190, alpha: 1 },
		},
	})
		.png()
		.toBuffer();
	await page.locator("#edit-dj-image-input").setInputFiles({
		name: "replacement.png",
		mimeType: "image/png",
		buffer: image,
	});

	await expect(page.getByRole("heading", { name: "Crop image" })).toBeVisible();
	const useImage = page.getByRole("button", { name: "Use image" });
	await expect(useImage).toBeEnabled();
	await useImage.click();

	const preview = page.getByRole("img", { name: "Selected preview" });
	await expect(preview).toBeVisible();
	await expect(preview).toHaveAttribute("src", /^blob:/);
	await page.getByRole("button", { name: "Save" }).click();
	await expect(page.getByRole("dialog", { name: "Edit DJ" })).toBeHidden();
});
