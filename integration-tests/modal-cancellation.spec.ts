import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
test.use({
	baseURL,
	httpCredentials: { username: "admin", password: "admin" },
});

// Keep interaction-only tests independent of archive data and persistence fixtures.
test.beforeEach(async ({ page }) => {
	await page.route("**/api/admin/djs", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([
				{
					id: 1,
					title: "Modal test DJ",
					bio: "Original bio",
					createdAt: "2026-09-29T00:00:00Z",
					tags: [],
					directTags: [],
					shows: [],
					image_large:
						"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='blue'/%3E%3C/svg%3E",
				},
			]),
		}),
	);
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
	await page.locator("#show-duration").fill("3600");
	await page.locator("#show-url").fill("https://example.com/show");
	await page.locator("#show-image-small").fill("https://example.com/small.jpg");
	await page.locator("#show-image-large").fill("https://example.com/large.jpg");
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

test("shared tag loading supports retry and reloads when either DJ form opens", async ({
	page,
}) => {
	await page.goto("/admin/#djs");
	await expect(
		page.getByRole("button", { name: "+ DJ", exact: true }),
	).toBeVisible();
	let requests = 0;
	await page.route("**/api/admin/tags", async (route) => {
		requests += 1;
		await route.fulfill({
			status: requests === 1 ? 500 : 200,
			contentType: "application/json",
			body:
				requests === 1
					? "{}"
					: JSON.stringify([
							{ id: 987, title: "Regression tag", color: "#abcdef" },
						]),
		});
	});
	await page.getByRole("button", { name: "+ DJ", exact: true }).click();
	await expect(
		page.getByText("Existing tags could not be loaded."),
	).toBeVisible();
	await page.getByRole("button", { name: /retry/i }).click();
	await page
		.getByRole("combobox", { name: "tags", exact: true })
		.fill("Regression");
	await expect(
		page.getByRole("option", { name: /Regression tag/ }),
	).toBeVisible();
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await page.getByRole("button", { name: "Discard changes" }).click();
	await page.getByRole("button", { name: "Edit", exact: true }).first().click();
	await expect(page.getByRole("dialog", { name: "Edit DJ" })).toBeFocused();
	await expect.poll(() => requests).toBe(3);
	await page
		.getByRole("combobox", { name: "tags", exact: true })
		.fill("Regression");
	await expect(
		page.getByRole("option", { name: /Regression tag/ }),
	).toBeVisible();
});

test("Show and DJ forms share tag suggestions and compact helper spacing", async ({
	page,
}) => {
	for (const resource of ["djs", "shows"]) {
		await page.goto(`/admin/#${resource}`);
		const add = page.getByRole("button", {
			name: resource === "djs" ? "+ DJ" : "+ show",
			exact: true,
		});
		await expect(add).toBeVisible();
		await page.route("**/api/admin/tags", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify([
					{ id: 987, title: "Regression tag", color: "#abcdef" },
				]),
			}),
		);
		await add.click();
		const form = page.getByRole("dialog", {
			name: resource === "djs" ? "Onboard DJ" : "Onboard Show",
		});
		await expect(form).toBeFocused();
		await expect(
			page.getByText(
				"Type to search. Press Tab to accept the gray completion.",
			),
		).toBeVisible();
		const input = form.getByRole("combobox", { name: "tags", exact: true });
		await input.fill("Regression");
		const alignment = await input.evaluate((element) => {
			const preview = element.parentElement?.querySelector(
				'[class*="preview"] > span',
			);
			const suffix = preview?.querySelector("span");
			if (!preview?.firstChild || !suffix?.firstChild) return undefined;
			const typedRange = document.createRange();
			typedRange.selectNodeContents(preview.firstChild);
			const suffixRange = document.createRange();
			suffixRange.selectNodeContents(suffix.firstChild);
			const typed = typedRange.getBoundingClientRect();
			const completion = suffixRange.getBoundingClientRect();
			return {
				vertical: Math.abs(typed.top - completion.top),
				horizontal: Math.abs(typed.right - completion.left),
			};
		});
		expect(alignment).toEqual({ vertical: 0, horizontal: 0 });
		await page.getByRole("option", { name: "Regression tag" }).click();
		await expect(
			form.getByRole("button", { name: "Remove Regression tag" }),
		).toBeVisible();
		const gap = await input.evaluate((element) => {
			const box = element.closest('[class*="box"]');
			const helper = element.closest('[class*="control"]')?.querySelector("p");
			return box && helper
				? helper.getBoundingClientRect().top -
						box.getBoundingClientRect().bottom
				: -1;
		});
		expect(gap).toBe(8);
		await form.getByRole("button", { name: "Cancel", exact: true }).click();
		await page.getByRole("button", { name: "Discard changes" }).click();
		await page.unroute("**/api/admin/tags");
	}
});

test("Show duration accepts whole seconds and sends them without conversion", async ({
	page,
}) => {
	let payload:
		| {
				duration: number;
				tags: string[];
				image_small: string;
				image_large: string;
		  }
		| undefined;
	await page.route("**/api/admin/create-show", async (route) => {
		payload = route.request().postDataJSON();
		await route.fulfill({
			status: 400,
			contentType: "application/json",
			body: JSON.stringify({ error: "Mock submission rejected" }),
		});
	});
	await page.goto("/admin/#shows");
	await page.getByRole("button", { name: "+ show", exact: true }).click();
	const form = page.getByRole("dialog", { name: "Onboard Show" });
	await expect(form).toBeFocused();
	const duration = form.getByRole("spinbutton", { name: "duration (seconds)" });
	await expect(duration).toHaveAttribute("min", "1");
	await expect(duration).toHaveAttribute("step", "1");
	await page.locator("#show-title").fill("Duration test");
	await page.locator("#show-date").fill("2026-09-29");
	await page.locator("#show-url").fill("https://example.com/show");
	await page.locator("#show-image-small").fill("https://example.com/small.jpg");
	await page.locator("#show-image-large").fill("https://example.com/large.jpg");
	await form.getByRole("checkbox").first().check();
	for (const value of ["", "0", "-1", "1.5", "2147483648"]) {
		await duration.fill(value);
		await form.getByRole("button", { name: "Submit", exact: true }).click();
		expect(
			await duration.evaluate(
				(input: HTMLInputElement) => input.validity.valid,
			),
		).toBe(false);
		expect(payload).toBeUndefined();
	}
	await duration.fill("3723");
	await page.locator("#show-tags").fill("new-duration-tag");
	await form.getByRole("button", { name: "Submit", exact: true }).click();
	await expect.poll(() => payload?.duration).toBe(3723);
	expect(payload?.tags).toContain("new-duration-tag");
	expect(payload?.image_small).toBe("https://example.com/small.jpg");
	expect(payload?.image_large).toBe("https://example.com/large.jpg");
	await expect(form.getByRole("alert")).toBeVisible();
	await expect(duration).toHaveValue("3723");
	await form.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(page.getByRole("alertdialog")).toBeVisible();
});
