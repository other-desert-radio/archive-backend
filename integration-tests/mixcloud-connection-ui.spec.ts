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
		for (const resource of ["shows", "djs", "tags"]) {
			await page.route(`**/api/admin/${resource}`, (route) =>
				route.fulfill({ json: [] }),
			);
		}
		await page.route("**/api/admin/mixcloud/**", (route) => {
			if (new URL(route.request().url()).pathname.endsWith("/uploads/pending"))
				return route.fulfill({ json: [] });
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
		await page.goto("/admin/#shows");
		await expect(page.getByText("UTILS", { exact: true })).toHaveCount(0);
		await expect(page.getByRole("link", { name: "⤷ upload" })).toHaveCount(0);
		const heading = page.getByRole("heading", { name: "SHOWS", exact: true });
		const guidance = page.getByText(
			"Sign in to mixcloud to begin uploading a show.",
			{ exact: false },
		);
		const search = page.getByRole("textbox", { name: "Search Shows" });
		await expect(guidance).toBeVisible();
		await expect(search).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({
			path: `/tmp/mixcloud-shows-${width}.png`,
			fullPage: true,
		});
		const titleBox = await heading.boundingBox();
		const bannerBox = await guidance.boundingBox();
		const searchBox = await search.boundingBox();
		expect(
			titleBox &&
				bannerBox &&
				searchBox &&
				titleBox.y + titleBox.height <= bannerBox.y &&
				bannerBox.y + bannerBox.height <= searchBox.y,
		).toBe(true);
		await expect(
			page.getByRole("button", { name: "sign into mixcloud" }),
		).toBeEnabled();
		await page.getByRole("button", { name: "sign into mixcloud" }).click();
		await expect(
			page.getByRole("heading", { name: "Mock consent" }),
		).toBeVisible();
		connected = true;
		await page.goto("/admin/?mixcloud=connected#shows");
		await expect(
			page.getByText("Signed into Mixcloud as", { exact: false }),
		).toBeVisible();
		await expect(page).toHaveURL(/\/admin\/#shows$/);
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
		await page.goto("/admin/?mixcloud=denied#shows");
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
