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
		await expect(
			page.getByRole("button", { name: "sign into mixcloud" }),
		).toHaveCount(0);
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		await expect(
			page.getByRole("dialog", { name: "Upload Show", exact: true }),
		).toBeVisible();
		await expect(page.locator("#show-title")).toHaveCount(0);
		await expect(page.locator("#show-mp3")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Upload to Mixcloud", exact: true }),
		).toBeDisabled();
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
		const connection = page.getByText("Signed into Mixcloud as", {
			exact: false,
		});
		await expect(connection).toHaveCSS("font-size", "12px");
		await expect(connection).toHaveText(
			"Signed into Mixcloud as Other Desert Radio",
		);
		await expect(
			page.getByRole("heading", { name: "MIXCLOUD", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByText("This show doesn't exist on Mixcloud yet.", {
				exact: false,
			}),
		).toHaveCount(0);
		const signOut = page.getByRole("button", { name: "sign out of mixcloud" });
		await expect(signOut).toHaveCSS("font-size", "12px");
		await expect(signOut).toHaveText("sign out");
		await expect(signOut).toHaveCSS("border-width", "0px");
		await expect(
			page.getByRole("dialog").locator("fieldset").first(),
		).toHaveCSS("margin-top", "8px");
		expect(
			await connection.evaluate((element) => {
				let parent = element.parentElement;
				while (parent && parent.getAttribute("role") !== "dialog") {
					if (getComputedStyle(parent).borderStyle.includes("dashed"))
						return true;
					parent = parent.parentElement;
				}
				return false;
			}),
		).toBe(false);
		await page.screenshot({
			path: `/tmp/mixcloud-connection-compact-${width}.png`,
		});
		await expect(page).toHaveURL(/\/admin\/#shows$/);
		await expect(page.locator("#show-title")).toBeVisible();
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
		await page.getByRole("button", { name: "+ show", exact: true }).click();
		await expect(page.getByRole("alert")).toBeVisible();
		fail = false;
		await page.getByRole("button", { name: "reload connection" }).click();
		await expect(
			page.getByRole("button", { name: "sign into mixcloud" }),
		).toBeEnabled();
		await expect(page.getByRole("alert")).toHaveCount(0);
	});
}
