import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://api:3000";
test.use({
	baseURL,
	httpCredentials: { username: "admin", password: "admin" },
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
			route.fulfill({ json: counts }),
		);
		await page.goto("/admin/#mixcloud");
		for (const [label, count] of [
			["ready for import", counts.auto_parsed],
			["needs review", counts.unparsable],
		] as const) {
			const button = page.getByRole("button", {
				name: new RegExp(`^${label}`),
			});
			await expect(button).toBeEnabled();
			await expect(button.locator("span")).toHaveCount(count === 0 ? 0 : 1);
			if (count > 0) {
				const badge = button.locator("span");
				await expect(badge).toHaveText(String(count));
				await expect(badge).toHaveCSS("background-color", "rgb(204, 0, 0)");
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
					? { auto_parsed: 1, unparsable: 2 }
					: { auto_parsed: 0, unparsable: 0 },
		});
	});
	await page.route("**/api/admin/refresh-mixcloud", (route) =>
		route.fulfill({ json: { status: "ok" } }),
	);
	await page.goto("/admin/#mixcloud");
	const ready = page.getByRole("button", { name: /^ready for import/ });
	const review = page.getByRole("button", { name: /^needs review/ });
	await expect(ready.locator("span")).toHaveText("1");
	await expect(review.locator("span")).toHaveText("2");
	await page
		.getByRole("button", { name: "Refresh Mixcloud", exact: true })
		.click();
	await expect(ready).toBeEnabled();
	await expect(ready.locator("span")).toHaveCount(0);
	await expect(review.locator("span")).toHaveCount(0);
	expect(statusRequests).toBe(2);
});
