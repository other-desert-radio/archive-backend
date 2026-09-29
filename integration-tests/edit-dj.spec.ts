import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
const djTitle = "Integration test DJ";

test.use({
	baseURL,
	httpCredentials: { username: "admin", password: "admin" },
});

test("replaces a DJ image and shows the cropped image preview before saving", async ({
	page,
}) => {
	await page.goto("/admin/#djs");
	await page.getByRole("button", { name: `Edit ${djTitle}` }).click();
	await page.getByRole("button", { name: "Replace" }).click();
	await page.locator("#edit-dj-image-input").setInputFiles({
		name: "replacement.png",
		mimeType: "image/png",
		buffer: Buffer.from(
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4YQAAAABJRU5ErkJggg==",
			"base64",
		),
	});

	await expect(page.getByRole("heading", { name: "Crop image" })).toBeVisible();
	await page.getByRole("button", { name: "Use image" }).click();

	const preview = page.getByRole("img", { name: "Selected preview" });
	await expect(preview).toBeVisible();
	await expect(preview).toHaveAttribute("src", /^blob:/);
	await page.getByRole("button", { name: "Save" }).click();
	await expect(page.getByRole("dialog", { name: "Edit DJ" })).toBeHidden();
});
