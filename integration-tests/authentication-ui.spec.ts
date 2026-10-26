import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import { Pool } from "pg";
import { adminCredentials, authOrigin } from "./auth-fixtures.js";

test.describe.configure({ mode: "serial" });
test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://api:3000" });
const clearRateLimits = async () => {
	if (
		!process.env.DATABASE_URL ||
		process.env.INTEGRATION_AUTH_SEED !== "disposable"
	)
		throw new Error("Disposable integration database required");
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		await pool.query('delete from "rateLimit"');
	} finally {
		await pool.end();
	}
};
test.beforeEach(clearRateLimits);
test.afterEach(clearRateLimits);
const login = async (page: Page, email: string, password: string) => {
	await page.getByLabel("email", { exact: true }).fill(email);
	await page.getByLabel("password", { exact: true }).fill(password);
	await page.getByRole("button", { name: /^sign in$/i }).click();
};
const checkFormFits = async (page: Page) => {
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);
	for (const input of await page.locator("input").all()) {
		await expect(input).toBeVisible();
		const box = await input.boundingBox();
		expect(box).not.toBeNull();
		if (box) {
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(
				page.viewportSize()?.width ?? 0,
			);
		}
	}
};

test("@auth sign-in panel fits desktop and phones, focuses email and preserves its destination", async ({
	page,
}) => {
	for (const width of [1280, 390, 320]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto(`/admin/?viewport=${width}#users`);
		await expect(page.getByLabel("email", { exact: true })).toBeFocused();
		await checkFormFits(page);
		await page.keyboard.press("Tab");
		await expect(page.getByLabel("password", { exact: true })).toBeFocused();
	}
	await login(page, adminCredentials.email, adminCredentials.password);
	await expect(
		page.getByRole("heading", { name: "Users", exact: true }),
	).toBeVisible();
	await expect(page).toHaveURL(/#users$/);
	await page.getByRole("button", { name: "Account", exact: true }).click();
	await page
		.getByRole("button", { name: "Change password", exact: true })
		.click();
	const dialog = page.getByRole("dialog", {
		name: "Change password",
		exact: true,
	});
	await expect(
		dialog.getByLabel("current password", { exact: true }),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await page.getByRole("button", { name: "Account", exact: true }).click();
	await page.getByRole("button", { name: "Sign out", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Sign in", exact: true }),
	).toBeVisible();
	await expect(page.getByLabel("password", { exact: true })).toHaveValue("");
});

test("@auth administrators create, edit, reset and delete accounts through the UI", async ({
	page,
	browser,
	baseURL,
}) => {
	test.setTimeout(90_000);
	const email = `browser-${randomUUID()}@example.test`;
	const initial = "initial browser editor password";
	const replacement = "replacement browser editor password";
	const reset = "reset browser editor password";
	const editorContext = await browser.newContext({ baseURL });
	const editor = await editorContext.newPage();
	let accountId: string | undefined;
	try {
		await page.goto("/admin/#users");
		await login(page, adminCredentials.email, adminCredentials.password);
		await page.getByRole("button", { name: "+ account", exact: true }).click();
		const create = page.getByRole("dialog", {
			name: "Create account",
			exact: true,
		});
		await create.getByLabel("email", { exact: true }).fill(email);
		await expect(create.getByLabel("role", { exact: true })).toHaveValue(
			"editor",
		);
		await create.getByLabel("new password", { exact: true }).fill(initial);
		await create.getByLabel("confirm password", { exact: true }).fill(initial);
		await create
			.getByRole("button", { name: "Create account", exact: true })
			.click();
		await expect(create).toHaveCount(0);
		const row = page.getByRole("row").filter({ hasText: email });
		await expect(row).toContainText("editor");
		const accounts = await (await page.request.get("/api/admin/users")).json();
		accountId = accounts.find(
			(account: { email: string }) => account.email === email,
		)?.id;
		expect(accountId).toBeTruthy();
		await editor.goto("/admin/#shows");
		await login(editor, email, initial);
		await expect(
			editor.getByRole("heading", {
				name: "Change your password",
				exact: true,
			}),
		).toBeVisible();
		for (const width of [1280, 390, 320]) {
			await editor.setViewportSize({ width, height: 900 });
			await checkFormFits(editor);
		}
		await expect(
			editor.getByLabel("current password", { exact: true }),
		).toBeFocused();
		await editor.getByLabel("current password", { exact: true }).fill(initial);
		await editor.getByLabel("new password", { exact: true }).fill(replacement);
		await editor
			.getByLabel("confirm password", { exact: true })
			.fill(replacement);
		await editor
			.getByRole("button", { name: "Save password", exact: true })
			.click();
		await expect(
			editor.getByRole("heading", { name: "SHOWS", exact: true }),
		).toBeVisible();
		await expect(
			editor.getByRole("link", { name: "⤷ users", exact: true }),
		).toHaveCount(0);
		await editor.goto("/admin/#users");
		await expect(editor.getByRole("alert")).toHaveText(
			"Administrator access is required.",
		);
		await row.getByRole("button", { name: "Edit", exact: true }).click();
		const role = page.getByRole("dialog", { name: "Change role", exact: true });
		await role.getByLabel("role", { exact: true }).selectOption("admin");
		await role.getByRole("button", { name: "Save", exact: true }).click();
		await expect(role).toHaveCount(0);
		await expect(row).toContainText("admin");
		await row
			.getByRole("button", { name: "Reset password", exact: true })
			.click();
		const resetDialog = page.getByRole("dialog", {
			name: "Reset password",
			exact: true,
		});
		await resetDialog.getByLabel("new password", { exact: true }).fill(reset);
		await resetDialog
			.getByLabel("confirm password", { exact: true })
			.fill(reset);
		await resetDialog
			.getByRole("button", { name: "Save", exact: true })
			.click();
		await expect(resetDialog).toHaveCount(0);
		const passwordColumn = await page
			.getByRole("columnheader", { name: "Password change required" })
			.evaluate((header) => (header as HTMLTableCellElement).cellIndex);
		await expect(row.getByRole("cell").nth(passwordColumn)).toHaveText("Yes");
		await editor.reload();
		await expect(
			editor.getByRole("heading", { name: "Sign in", exact: true }),
		).toBeVisible();
		await login(editor, email, reset);
		await expect(
			editor.getByRole("heading", {
				name: "Change your password",
				exact: true,
			}),
		).toBeVisible();
		await row.getByRole("button", { name: "Delete", exact: true }).click();
		const deletion = page.getByRole("alertdialog", {
			name: "Delete account?",
			exact: true,
		});
		await expect(
			deletion.getByRole("button", { name: "Cancel", exact: true }),
		).toBeFocused();
		await deletion
			.getByRole("button", { name: "Delete account", exact: true })
			.click();
		await expect(row).toHaveCount(0);
		accountId = undefined;
		await editor.reload();
		await expect(
			editor.getByRole("heading", { name: "Sign in", exact: true }),
		).toBeVisible();
	} finally {
		if (accountId)
			await page.request.post("/api/admin/remove-user", {
				headers: { origin: authOrigin },
				data: { id: accountId },
			});
		await editorContext.close();
	}
});
