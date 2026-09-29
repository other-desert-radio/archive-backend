import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
test.use({
	baseURL,
	httpCredentials: { username: "admin", password: "admin" },
});

test("all dismissal paths protect drafts and confirmation preserves focus", async ({
	page,
}) => {
	await page.goto("/admin/#djs");
	await page.getByRole("button", { name: "+ DJ", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Onboard DJ" });
	const title = page.locator("#onboard-dj-title-input");
	await title.fill("Draft");
	for (const path of ["cancel", "close", "escape", "backdrop"]) {
		if (path === "cancel")
			await form.getByRole("button", { name: "Cancel", exact: true }).click();
		if (path === "close")
			await form.getByRole("button", { name: "Close", exact: true }).click();
		if (path === "escape") await title.press("Escape");
		if (path === "backdrop")
			await page
				.locator("div")
				.filter({ has: form })
				.last()
				.click({ position: { x: 2, y: 2 } });
		const confirmation = page.getByRole("alertdialog");
		await expect(confirmation).toBeVisible();
		await expect(
			confirmation.getByRole("button", { name: "Keep editing" }),
		).toBeFocused();
		await page.keyboard.press("Shift+Tab");
		await expect(
			confirmation.getByRole("button", { name: "Discard changes" }),
		).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(confirmation).toBeHidden();
		await expect(title).toHaveValue("Draft");
	}
	await title.fill("");
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(form).toBeHidden();
	await page.getByRole("button", { name: "+ DJ", exact: true }).click();
	await page
		.getByRole("combobox", { name: "tags", exact: true })
		.fill("uncommitted");
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await page.getByRole("button", { name: "Discard changes" }).click();
	await expect(form).toBeHidden();
});

test("Show selections and failed submissions retain unsaved changes", async ({
	page,
}) => {
	await page.goto("/admin/#shows");
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Onboard Show" });
	const checkbox = form.getByRole("checkbox").first();
	await checkbox.check();
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await page.getByRole("button", { name: "Keep editing" }).click();
	await expect(checkbox).toBeChecked();
	await checkbox.uncheck();
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(form).toBeHidden();
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	await page.locator("#show-title").fill("Draft");
	await page.locator("#show-date").fill("2026-09-29");
	await page.locator("#show-url").fill("https://example.com/show");
	await form.getByRole("button", { name: "Submit", exact: true }).click();
	await expect(form.getByRole("alert")).toContainText("Select at least one DJ");
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.getByRole("alertdialog")).toBeVisible();
});

test("edit image undo and crop layering protect the parent form", async ({
	page,
}) => {
	await page.goto("/admin/#djs");
	await page.getByRole("button", { name: "Edit", exact: true }).first().click();
	const form = page.getByRole("dialog", { name: "Edit DJ" });
	const remove = form.getByRole("button", { name: "Remove", exact: true });
	if (await remove.count()) {
		await remove.click();
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await page.getByRole("button", { name: "Keep editing" }).click();
		await form.getByRole("button", { name: "Undo", exact: true }).click();
		await form.getByRole("button", { name: "Replace", exact: true }).click();
	}
	const sharp = (await import("sharp")).default;
	const buffer = await sharp({
		create: { width: 64, height: 64, channels: 4, background: "blue" },
	})
		.png()
		.toBuffer();
	await page
		.locator("#edit-dj-image-input")
		.setInputFiles({ name: "crop.png", mimeType: "image/png", buffer });
	const crop = page.getByRole("dialog", { name: "Crop image" });
	await expect(crop).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(crop).toBeHidden();
	await expect(page.getByRole("alertdialog")).toBeHidden();
	await expect(form).toBeVisible();
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(form).toBeHidden();
});

test("submission blocks dismissal and successful save bypasses confirmation", async ({
	page,
}) => {
	let finish: (() => void) | undefined;
	await page.route("**/api/admin/modify-dj", async (route) => {
		await new Promise<void>((resolve) => {
			finish = resolve;
		});
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ id: 1 }),
		});
	});
	await page.goto("/admin/#djs");
	await page.getByRole("button", { name: "Edit", exact: true }).first().click();
	const form = page.getByRole("dialog", { name: "Edit DJ" });
	await page.locator("#edit-dj-title-input").fill("Changed draft");
	await form.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		form.getByRole("button", { name: "Cancel", exact: true }),
	).toBeDisabled();
	await page.keyboard.press("Escape");
	await page
		.locator("div")
		.filter({ has: form })
		.last()
		.click({ position: { x: 2, y: 2 } });
	await expect(form).toBeVisible();
	await expect(page.getByRole("alertdialog")).toBeHidden();
	await expect.poll(() => typeof finish).toBe("function");
	finish?.();
	await expect(form).toBeHidden();
	await expect(page.getByRole("alertdialog")).toBeHidden();
});
