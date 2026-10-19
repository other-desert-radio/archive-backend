import { readFile } from "node:fs/promises";
import type { APIRequestContext } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

export const authOrigin =
	process.env.E2E_AUTH_ORIGIN ??
	process.env.E2E_BASE_URL ??
	"http://127.0.0.1:3001";

export const adminCredentials = {
	email: "integration-admin@example.test",
	password: "integration admin password 2026",
};

export const signIn = async (
	request: APIRequestContext,
	email = adminCredentials.email,
	password = adminCredentials.password,
) => {
	const response = await request.post("/api/auth/sign-in/email", {
		data: { email, password },
		headers: { origin: authOrigin },
	});
	expect(response.ok(), await response.text()).toBe(true);
};

export const sessionSnapshotPath = "/tmp/archive-integration-session.json";
export const authStatePath = "/tmp/archive-integration-auth.json";

// Generated once before archive suites, shared across replacement workers.
export const test = base.extend({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
	extraHTTPHeaders: { origin: authOrigin },
	storageState: authStatePath,
	page: async ({ page }, use) => {
		// Resource suites reuse one real session lookup; auth suites use base Playwright.
		const snapshot = await readFile(sessionSnapshotPath, "utf8");
		await page.route("**/api/auth/get-session", (route) =>
			route.fulfill({ contentType: "application/json", body: snapshot }),
		);
		await use(page);
	},
});
