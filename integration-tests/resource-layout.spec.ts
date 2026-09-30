import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
test.use({
	baseURL,
	httpCredentials: { username: "admin", password: "admin" },
});

test.beforeEach(async ({ page }) => {
	await page.route("**/api/admin/djs", (route) =>
		route.fulfill({
			json: Array.from({ length: 12 }, (_, index) => ({
				id: index + 1,
				title: `Layout DJ ${index}`,
				bio: "Test biography",
				createdAt: "2026-09-29T00:00:00Z",
				tags: [],
				directTags: [],
				shows: [],
			})),
		}),
	);
	await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }));
});

for (const width of [1440, 1024, 768, 505, 504, 390, 320]) {
	test(`resource bounds and controls at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/admin/#djs");
		await page.getByRole("button", { name: "table", exact: true }).click();
		await page.evaluate(() => document.fonts.ready);
		const title = await page
			.getByRole("heading", { name: "DJs", exact: true })
			.boundingBox();
		const search = await page
			.getByRole("textbox", { name: "Search DJs" })
			.boundingBox();
		const add = await page
			.getByRole("button", { name: "+ DJ", exact: true })
			.boundingBox();
		expect(title).toBeTruthy();
		expect(search).toBeTruthy();
		expect(add).toBeTruthy();
		if (!title || !search || !add) throw new Error("Missing resource controls");
		expect(Math.abs(title.x - search.x)).toBeLessThan(1);
		expect(Math.abs(title.x + title.width - add.x - add.width)).toBeLessThan(1);
		if (width <= 450) {
			expect(search.width).toBeCloseTo(width - 40, 0);
			expect(add.y).toBeGreaterThanOrEqual(search.y + search.height);
		}
		const bounds = await page.getByRole("table").evaluate((table) => {
			const wrapper = table.parentElement;
			if (!wrapper) throw new Error("Missing table wrapper");
			const rect = wrapper.getBoundingClientRect();
			const sidebar = document.querySelector("aside")?.getBoundingClientRect();
			const desktop = matchMedia("(min-width: 42.001rem)").matches;
			wrapper.scrollLeft = 300;
			return {
				x: rect.x,
				right: rect.right,
				desktop,
				sidebarRight: sidebar?.right ?? 0,
				scroll: wrapper.scrollLeft,
				actionX: table.querySelector("tbody td")?.getBoundingClientRect().x,
				documentWidth: document.documentElement.scrollWidth,
			};
		});
		expect(bounds.x).toBeCloseTo(
			bounds.desktop ? bounds.sidebarRight + 40 : 20,
			0,
		);
		expect(bounds.right).toBeCloseTo(width - (bounds.desktop ? 40 : 20), 0);
		expect(title.x).toBeCloseTo(bounds.x, 0);
		expect(title.x + title.width).toBeCloseTo(bounds.right, 0);
		expect(bounds.documentWidth).toBe(width);
		expect(bounds.scroll).toBeGreaterThan(0);
		expect(bounds.actionX).toBeCloseTo(bounds.x, 0);
		await page.getByRole("textbox", { name: "Search DJs" }).fill("Layout DJ 0");
		await expect(page.getByRole("table").locator("tbody tr")).toHaveCount(1);
		await page.getByRole("textbox", { name: "Search DJs" }).fill("");
		await page.getByRole("button", { name: "grid", exact: true }).click();
		const grid = page.locator('[class*="grid"]');
		await expect(grid).toBeVisible();
		const gridBounds = await grid.evaluate((element) => ({
			x: element.getBoundingClientRect().x,
			right: element.getBoundingClientRect().right,
			columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
			scrollWidth: document.documentElement.scrollWidth,
		}));
		expect(gridBounds.x).toBeCloseTo(bounds.x, 0);
		expect(gridBounds.right).toBeCloseTo(bounds.right, 0);
		expect(gridBounds.scrollWidth).toBe(width);
		if (width === 768) expect(gridBounds.columns).toBe(2);
		await page.evaluate(() => window.scrollTo(0, 500));
		await expect
			.poll(() =>
				page
					.getByRole("textbox", { name: "Search DJs" })
					.evaluate(
						(input) =>
							getComputedStyle(input.parentElement as HTMLElement).paddingLeft,
					),
			)
			.toBe(width <= 450 ? "12px" : "16px");
		const stickySearch = await page
			.getByRole("textbox", { name: "Search DJs" })
			.boundingBox();
		const header = await page.locator("header").first().boundingBox();
		const stickyAdd = await page
			.getByRole("button", { name: "+ DJ", exact: true })
			.boundingBox();
		expect(stickySearch).toBeTruthy();
		expect(stickyAdd).toBeTruthy();
		if (!stickySearch || !stickyAdd) throw new Error("Missing sticky controls");
		const stickyPadding = width <= 450 ? 12 : 16;
		expect(stickySearch.x).toBeCloseTo(bounds.x + stickyPadding, 0);
		expect(stickyAdd.x + stickyAdd.width).toBeCloseTo(
			bounds.right - stickyPadding,
			0,
		);
		expect(stickySearch?.y).toBeGreaterThanOrEqual(header?.height ?? 0);
		expect(stickySearch?.y).toBeLessThan(100);
	});
}
