import { expect, type Locator, test } from "@playwright/test";

// Reads and writes are intercepted; no archive records are changed.
test.use({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	httpCredentials: { username: "admin", password: "admin" },
});
const tags = [
	{
		id: 1,
		title: "Ambient",
		color: "#abcdef",
		reviewed: false,
		mixcloud_key: "ambient",
		mixcloud_url: "https://example.test/ambient",
	},
	{
		id: 2,
		title: "A very long experimental tag name that wraps",
		color: "#fedcba",
		reviewed: true,
	},
];
const choose = async (input: Locator, color: string) => {
	await input.evaluate((element, value) => {
		const input = element as HTMLInputElement;
		const setter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		setter?.call(input, value);
		input.dispatchEvent(new Event("input", { bubbles: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));
	}, color);
};
test.beforeEach(async ({ page }) => {
	await page.route("**/api/admin/tags", (route) =>
		route.fulfill({ json: tags }),
	);
	await page.goto("/admin/#tags");
	await page.getByRole("button", { name: "grid", exact: true }).click();
});

test("preview, cancellation and failed-save retry use only the partial color payload", async ({
	page,
}) => {
	let attempts = 0;
	let release: (() => void) | undefined;
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/admin/modify-tag", async (route) => {
		expect(route.request().postDataJSON()).toEqual({
			edit_type: "partial_edit",
			id: 1,
			color: "#123456",
		});
		attempts++;
		if (attempts === 1) {
			await pending;
			await route.fulfill({ status: 500, json: { error: "Save failed" } });
		} else
			await route.fulfill({
				json: { ...tags[0], color: "#123456", reviewed: true },
			});
	});
	const card = page.getByRole("article", { name: "Tag Ambient", exact: true });
	const swatch = card.getByLabel("Choose color for Ambient", { exact: true });
	const chip = card.locator("span").first();
	await choose(swatch, "#123456");
	await expect(chip).toHaveCSS("background-color", "rgb(18, 52, 86)");
	await expect(
		card.getByRole("button", { name: "Edit Ambient", exact: true }),
	).toHaveCount(0);
	await card
		.getByRole("button", { name: "Cancel color change for Ambient" })
		.click();
	await expect(swatch).toHaveValue("#abcdef");
	expect(attempts).toBe(0);
	await choose(swatch, "#123456");
	const save = card.getByRole("button", {
		name: "Save color for Ambient",
		exact: true,
	});
	await save.click();
	await expect(swatch).toBeDisabled();
	await expect(save).toBeDisabled();
	await expect(
		card.getByRole("button", { name: "Cancel color change for Ambient" }),
	).toBeDisabled();
	expect(attempts).toBe(1);
	release?.();
	await expect(card.getByRole("alert")).toBeVisible();
	await expect(swatch).toHaveValue("#123456");
	await save.click();
	await expect(
		card.getByRole("button", { name: "Edit Ambient", exact: true }),
	).toBeVisible();
	await expect(card.getByRole("alert")).toHaveCount(0);
	await expect(swatch).toBeFocused();
	expect(attempts).toBe(2);
	await page.getByRole("button", { name: "table", exact: true }).click();
	const row = page.getByRole("row").filter({ hasText: "Ambient" });
	await expect(row).toContainText("true");
	await expect(row).toContainText("https://example.test/ambient");
});

test("grid and table share sorting, filtering, preference and the existing edit modal", async ({
	page,
}) => {
	await expect(page.getByRole("article").first()).toHaveAttribute(
		"aria-label",
		`Tag ${tags[1].title}`,
	);
	await page.reload();
	await expect(
		page.getByRole("button", { name: "grid", exact: true }),
	).toHaveAttribute("aria-pressed", "true");
	await page.getByLabel("Search Tags").fill("Ambient");
	await expect(page.getByRole("article")).toHaveCount(1);
	await page.getByRole("button", { name: "Edit Ambient", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Edit Tag" });
	await expect(dialog.locator("#edit-tag-title")).toHaveValue("Ambient");
	await expect(dialog.locator("#edit-tag-color")).toHaveValue("#abcdef");
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await page.getByLabel("Search Tags").fill("");
	await page.getByRole("button", { name: "table", exact: true }).click();
	await page.getByRole("button", { name: /^title / }).click();
	await page.getByRole("button", { name: "grid", exact: true }).click();
	await expect(page.getByRole("article").first()).toHaveAttribute(
		"aria-label",
		`Tag ${tags[1].title}`,
	);
	await page.getByLabel("Search Tags").fill("nonexistent");
	await expect(page.getByText("No tags match your search.")).toBeVisible();
});

test("filtering out cards and switching views discard drafts", async ({
	page,
}) => {
	const swatch = page.getByLabel("Choose color for Ambient", { exact: true });
	await choose(swatch, "#123456");
	await page.getByLabel("Search Tags").fill("experimental");
	await expect(swatch).toHaveCount(0);
	await page.getByLabel("Search Tags").fill("");
	await expect(swatch).toHaveValue("#abcdef");
	await choose(swatch, "#123456");
	await page.getByRole("button", { name: "table", exact: true }).click();
	await page.getByRole("button", { name: "grid", exact: true }).click();
	await expect(swatch).toHaveValue("#abcdef");
	await choose(swatch, "#ABCDEF");
	await expect(
		page.getByRole("button", { name: "Edit Ambient", exact: true }),
	).toBeVisible();
});

for (const width of [1440, 768, 390, 320]) {
	test(`large tags and controls fit at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.evaluate(() => document.fonts.ready);
		await expect(page.getByRole("article")).toHaveCount(2);
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth),
		).toBe(width);
		const sizes = await page
			.getByRole("article")
			.first()
			.locator("span")
			.first()
			.evaluate((chip) => ({
				root: Number.parseFloat(
					getComputedStyle(document.documentElement).fontSize,
				),
				chip: Number.parseFloat(getComputedStyle(chip).fontSize),
			}));
		expect(sizes.chip).toBeCloseTo(sizes.root * 2.625, 3);
		for (const card of await page.getByRole("article").all()) {
			const bounds = await card.boundingBox();
			expect(bounds).toBeTruthy();
			if (!bounds) throw new Error("Missing card");
			for (const control of await card.locator("input, button").all()) {
				const rect = await control.boundingBox();
				expect(rect).toBeTruthy();
				if (!rect) throw new Error("Missing control");
				expect(rect.x).toBeGreaterThanOrEqual(bounds.x);
				expect(rect.x + rect.width).toBeLessThanOrEqual(
					bounds.x + bounds.width + 1,
				);
				expect(rect.height).toBeGreaterThanOrEqual(42);
			}
		}
	});
}
