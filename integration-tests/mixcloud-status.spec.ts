import { expect } from "@playwright/test";
import { test } from "./auth-fixtures.js";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
test.use({
	baseURL,
});

test.beforeEach(async ({ page }) => {
	await page.route("**/api/admin/mixcloud-imports", (route) =>
		route.fulfill({ json: [] }),
	);
});

for (const counts of [
	{ auto_parsed: 0, unparsable: 7 },
	{ auto_parsed: 8, unparsable: 0 },
	{ auto_parsed: 0, unparsable: 0 },
	{ auto_parsed: 123, unparsable: 456 },
]) {
	test(`renders only nonzero badges: ${JSON.stringify(counts)}`, async ({
		page,
	}) => {
		await page.route("**/api/admin/mixcloud-import/status", (route) =>
			route.fulfill({ json: { ...counts, missing_djs: [] } }),
		);
		await page.goto("/admin/#mixcloud");
		for (const [label, count] of [
			["ready for import", counts.auto_parsed],
			["needs review", counts.unparsable],
		] as const) {
			const button = page.getByRole("button", {
				name: new RegExp(`^${label}`),
			});
			if (count > 0) await expect(button).toBeEnabled();
			else await expect(button).toBeDisabled();
			await expect(button.locator("span")).toHaveCount(count === 0 ? 0 : 1);
			if (count > 0) {
				const badge = button.locator("span");
				await expect(badge).toHaveText(String(count));
				await expect(badge).toHaveCSS(
					"background-color",
					label === "ready for import" ? "rgb(0, 128, 0)" : "rgb(204, 0, 0)",
				);
				await expect(badge).toHaveCSS("color", "rgb(255, 255, 255)");
				await expect(badge).toHaveCSS("border-top-color", "rgb(0, 0, 0)");
				await expect(badge).toHaveCSS("border-top-width", "1px");
				await expect(badge).toHaveCSS("border-radius", "0px");
				const bounds = await badge.boundingBox();
				expect(bounds?.width).toBe(bounds?.height);
			} else await expect(button).toHaveText(label);
		}
	});
}

test("removes badges when refreshed counts become zero", async ({ page }) => {
	let statusRequests = 0;
	await page.route("**/api/admin/mixcloud-import/status", (route) => {
		statusRequests++;
		return route.fulfill({
			json:
				statusRequests === 1
					? {
							auto_parsed: 1,
							unparsable: 2,
							missing_djs: ["DJ Alice", "DJ Bob"],
						}
					: { auto_parsed: 0, unparsable: 0, missing_djs: [] },
		});
	});
	await page.route("**/api/admin/refresh-mixcloud", (route) =>
		route.fulfill({ json: { status: "ok" } }),
	);
	await page.goto("/admin/#mixcloud");
	await expect(
		page.getByText("Missing DJs: DJ Alice, DJ Bob", { exact: true }),
	).toBeVisible();
	const ready = page.getByRole("button", { name: /^ready for import/ });
	const review = page.getByRole("button", { name: /^needs review/ });
	await expect(ready.locator("span")).toHaveText("1");
	await expect(review.locator("span")).toHaveText("2");
	await page
		.getByRole("button", { name: "Refresh Mixcloud", exact: true })
		.click();
	await expect(ready).toBeDisabled();
	await expect(ready.locator("span")).toHaveCount(0);
	await expect(review.locator("span")).toHaveCount(0);
	await expect(page.getByText(/^Missing DJs:/)).toHaveCount(0);
	expect(statusRequests).toBe(2);
});

test("missing DJs banner spans the resource below search and survives filtering", async ({
	page,
}) => {
	await page.route("**/api/admin/mixcloud-imports", (route) =>
		route.fulfill({
			json: [
				{
					id: 1,
					key: "/odr/pending/",
					data_changed: false,
					djs: [],
					dj_names: [],
					tags: [],
				},
			],
		}),
	);
	const names = ["DJ Alice", "DJ Bob", "A".repeat(150)];
	await page.route("**/api/admin/mixcloud-import/status", (route) =>
		route.fulfill({
			json: { auto_parsed: 0, unparsable: 1, missing_djs: names },
		}),
	);
	await page.goto("/admin/#mixcloud");
	const banner = page.getByText(`Missing DJs: ${names.join(", ")}`, {
		exact: true,
	});
	const search = page.getByRole("textbox", { name: "Search Mixcloud" });
	await expect(banner).toBeVisible();
	for (const width of [1440, 390, 320]) {
		await page.setViewportSize({ width, height: 1000 });
		const bannerBox = await banner.boundingBox();
		const sectionBox = await banner.locator("..").boundingBox();
		const searchBox = await search.boundingBox();
		expect(bannerBox?.width).toBe(sectionBox?.width);
		expect(bannerBox?.y).toBeGreaterThan(
			(searchBox?.y ?? 0) + (searchBox?.height ?? 0),
		);
		expect(
			await banner.evaluate(
				(element) => element.scrollWidth <= element.clientWidth,
			),
		).toBe(true);
	}
	await search.fill("no matching row");
	await expect(
		page.getByText("No Mixcloud imports match your filters."),
	).toBeVisible();
	await expect(banner).toBeVisible();
});
