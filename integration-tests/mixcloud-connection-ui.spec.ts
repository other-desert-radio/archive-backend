import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:43827" });

for (const width of [1440, 390, 320]) {
	test(`Mixcloud connect, return, disconnect and retry at ${width}px`, async ({
		page,
	}) => {
		let connected = false;
		let fail = false;
		let disconnects = 0;
		await page.setViewportSize({ width, height: 900 });
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({
				json: {
					user: {
						id: "editor",
						email: "editor@example.test",
						role: "editor",
						mustChangePassword: false,
					},
				},
			}),
		);
		await page.route("**/api/admin/mixcloud/*", (route) => {
			const path = new URL(route.request().url()).pathname;
			if (path.endsWith("/connect"))
				return route.fulfill({
					json: {
						authorizationUrl:
							"https://www.mixcloud.com/oauth/authorize?client_id=test&state=test",
					},
				});
			if (path.endsWith("/disconnect")) {
				connected = false;
				disconnects++;
				return route.fulfill({ json: { disconnected: true } });
			}
			return route.fulfill(
				fail
					? { status: 500, json: { error: "Unavailable" } }
					: {
							json: connected
								? {
										configured: true,
										connected: true,
										account: {
											key: "/otherdesertradio/",
											displayName: "Other Desert Radio",
										},
									}
								: { configured: true, connected: false },
						},
			);
		});
		await page.route("https://www.mixcloud.com/oauth/authorize?**", (route) =>
			route.fulfill({
				contentType: "text/html",
				body: "<h1>Mock consent</h1>",
			}),
		);
		await page.goto("/admin/#upload");
		await expect(
			page.getByRole("button", { name: "sign into mixcloud" }),
		).toBeEnabled();
		await page.getByRole("button", { name: "sign into mixcloud" }).click();
		await expect(
			page.getByRole("heading", { name: "Mock consent" }),
		).toBeVisible();
		connected = true;
		await page.goto("/admin/?mixcloud=connected#upload");
		await expect(
			page.getByText("Signed into Mixcloud as", { exact: false }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/admin\/#upload$/);
		await page.evaluate(() => document.fonts.ready);
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
		await page.getByRole("button", { name: "sign out of mixcloud" }).focus();
		await expect(
			page.getByRole("button", { name: "sign out of mixcloud" }),
		).toBeFocused();
		await page.keyboard.press("Enter");
		await expect(
			page.getByRole("button", { name: "sign into mixcloud" }),
		).toBeEnabled();
		expect(disconnects).toBe(1);
		await page.goto("/admin/?mixcloud=denied#upload");
		await expect(page.getByRole("status")).toHaveText(
			"Mixcloud sign-in was cancelled.",
		);
		fail = true;
		await page.reload();
		await expect(page.getByRole("alert")).toBeVisible();
		fail = false;
		await page.getByRole("button", { name: "reload connection" }).click();
		await expect(
			page.getByRole("button", { name: "sign into mixcloud" }),
		).toBeEnabled();
		await expect(page.getByRole("alert")).toHaveCount(0);
	});
}
