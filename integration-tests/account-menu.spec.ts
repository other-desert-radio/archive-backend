import { expect, test } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:43827";
test.use({ baseURL });

for (const width of [1440, 390, 320]) {
	test(`account dialog dismissal, password transition, and sign-out at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		let signedOut = false;
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({
				json: signedOut
					? {}
					: {
							user: {
								id: "editor",
								email: "editor@example.test",
								role: "editor",
								mustChangePassword: false,
							},
						},
			}),
		);
		await page.route("**/api/admin/djs", (route) =>
			route.fulfill({ json: [] }),
		);
		await page.route("**/api/admin/tags", (route) =>
			route.fulfill({ json: [] }),
		);
		let releaseRequest: (() => void) | undefined;
		let attempts = 0;
		await page.route("**/api/auth/sign-out", async (route) => {
			attempts++;
			if (attempts === 1) {
				await new Promise<void>((resolve) => {
					releaseRequest = resolve;
				});
				await route.fulfill({ status: 500, json: { error: "Failed" } });
			} else {
				signedOut = true;
				await route.fulfill({ json: { success: true } });
			}
		});
		await page.goto("/admin/#djs");
		const opener = page.getByRole("button", { name: "Account", exact: true });
		await expect(page.locator("aside")).not.toContainText(
			"editor@example.test",
		);
		await opener.click();
		const dialog = page.getByRole("dialog", { name: "Signed In" });
		await expect(dialog).toContainText("editor@example.test");
		await expect(
			dialog.getByRole("button", { name: "Change password" }),
		).toBeFocused();
		await page.keyboard.press("Tab");
		await expect(
			dialog.getByRole("button", { name: "Close dialog" }),
		).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(opener).toBeFocused();
		await opener.click();
		await dialog.getByRole("button", { name: "Change password" }).click();
		await expect(
			page.getByRole("dialog", { name: "Change password" }),
		).toBeVisible();
		await expect(dialog).not.toBeVisible();
		await page.keyboard.press("Escape");
		await expect(opener).toBeFocused();
		await opener.click();
		await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
		await expect(
			dialog.getByRole("button", { name: "Signing out…" }),
		).toBeDisabled();
		await expect(
			dialog.getByRole("button", { name: "Change password" }),
		).toBeDisabled();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeVisible();
		await expect.poll(() => Boolean(releaseRequest)).toBe(true);
		releaseRequest?.();
		await expect(dialog.getByRole("alert")).toHaveText(
			"Unable to sign out. Try again.",
		);
		await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
		await expect(
			page.getByRole("button", { name: "Sign in", exact: true }),
		).toBeVisible();
		expect(attempts).toBe(2);
	});
}
