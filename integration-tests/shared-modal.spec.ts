import { rm } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { buildSharedModalFixture } from "./fixtures/build-shared-modal.js";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
test.use({
	baseURL,
	httpCredentials: { username: "admin", password: "admin" },
});
let fixture: Awaited<ReturnType<typeof buildSharedModalFixture>>;
test.beforeAll(async () => {
	fixture = await buildSharedModalFixture();
});
test.afterAll(async () => {
	if (fixture) await rm(fixture.directory, { recursive: true, force: true });
});
test.beforeEach(async ({ page }) => {
	await page.route("**/admin/__modal-test/**", async (route) => {
		const name = new URL(route.request().url()).pathname.replace(
			"/admin/__modal-test/",
			"",
		);
		if (name === "")
			return route.fulfill({ contentType: "text/html", body: fixture.html });
		const body = fixture.assets.get(name);
		if (!body) return route.fulfill({ status: 404 });
		return route.fulfill({
			contentType: name.endsWith(".js")
				? "text/javascript"
				: name.endsWith(".css")
					? "text/css"
					: name.endsWith(".woff2")
						? "font/woff2"
						: "image/jpeg",
			body,
		});
	});
	await page.goto("/admin/__modal-test/");
});

test("clean and dirty navigation, discard focus, and successful-save advance", async ({
	page,
}) => {
	const opener = page.getByRole("button", { name: "Open fixture" });
	await opener.click();
	await expect(page.getByText("29 remaining")).toBeVisible();
	await page.getByRole("button", { name: "Skip", exact: true }).click();
	await expect(
		page.getByRole("dialog", { name: "Import fixture 2" }),
	).toBeVisible();
	for (const action of ["Skip", "Next Show"]) {
		await page.getByLabel("title", { exact: true }).fill("Draft");
		const button = page.getByRole("button", { name: action, exact: true });
		await button.click();
		await expect(page.getByRole("alertdialog")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Keep editing" }),
		).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(button).toBeFocused();
		await expect(page.getByLabel("title", { exact: true })).toHaveValue(
			"Draft",
		);
		await button.click();
		await page.getByRole("button", { name: "Discard changes" }).click();
		await expect(page.getByLabel("title", { exact: true })).toHaveValue("");
	}
	await expect(
		page.getByRole("dialog", { name: "Import fixture 4" }),
	).toBeVisible();
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(
		page.getByRole("dialog", { name: "Import fixture 5" }),
	).toBeVisible();
	await expect(page.getByLabel("Submission count")).toHaveText("1");
	await page.getByRole("button", { name: "Close", exact: true }).click();
	await expect(opener).toBeFocused();
});

test("failed save preserves drafts, retry advances, and pending saves block actions", async ({
	page,
}) => {
	await page.getByLabel("Fail save").check();
	await page.getByRole("button", { name: "Open fixture" }).click();
	await page.getByLabel("title", { exact: true }).fill("Retained");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByRole("alert")).toHaveText("Fixture save failed");
	await expect(page.getByLabel("title", { exact: true })).toHaveValue(
		"Retained",
	);
	await page.evaluate(() =>
		(
			document.querySelector('input[type="checkbox"]') as HTMLInputElement
		).click(),
	);
	await page.evaluate(() =>
		(
			document.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement
		).click(),
	);
	await page.getByRole("button", { name: "Save", exact: true }).click();
	for (const name of ["Submitting…", "Skip", "Next Show", "Close"])
		await expect(
			page.getByRole("button", { name, exact: true }),
		).toBeDisabled();
	await page.keyboard.press("Escape");
	await expect(
		page.getByRole("dialog", { name: "Import fixture 1" }),
	).toBeVisible();
	await page.evaluate(() => {
		const form = document.querySelector("form");
		form?.dispatchEvent(
			new Event("submit", { bubbles: true, cancelable: true }),
		);
		(document.querySelectorAll("button")[1] as HTMLButtonElement).click();
	});
	await expect(
		page.getByRole("dialog", { name: "Import fixture 2" }),
	).toBeVisible();
	await expect(page.getByLabel("Submission count")).toHaveText("2");
	await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const width of [1280, 390, 320])
	test(`helpers, navigation bounds, and focus containment at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 844 });
		await page.getByRole("button", { name: "Open fixture" }).click();
		await expect(
			page.getByRole("combobox", { name: "Search DJs" }),
		).toHaveAccessibleDescription(/Unmatched DJs: Unrecognized source name/);
		await expect(
			page.getByRole("combobox", { name: "tags" }),
		).toHaveAccessibleDescription(/Unresolved keys:/);
		const next = page.getByRole("button", { name: "Next Show" });
		await next.focus();
		await page.keyboard.press("Tab");
		await expect(
			page.getByRole("button", { name: "Close", exact: true }),
		).toBeFocused();
		await page.keyboard.press("Shift+Tab");
		await expect(next).toBeFocused();
		const bounds = await next.boundingBox();
		expect(bounds).not.toBeNull();
		expect(bounds?.x).toBeGreaterThanOrEqual(0);
		expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(width);
		await page
			.getByRole("button", { name: "Skip", exact: true })
			.scrollIntoViewIfNeeded();
		await expect(
			page.getByRole("button", { name: "Skip", exact: true }),
		).toBeVisible();
		await page.getByRole("button", { name: "Close", exact: true }).click();
		await expect(page.getByRole("dialog")).toBeHidden();
	});
