import { writeFile } from "node:fs/promises";
import { expect, request } from "@playwright/test";
import { authStatePath, sessionSnapshotPath, signIn } from "./auth-fixtures.js";

const context = await request.newContext({
	baseURL: process.env.E2E_BASE_URL ?? "http://api:3000",
});
try {
	expect((await context.get("/health")).status()).toBe(200);
	await signIn(context);
	const response = await context.get("/api/auth/get-session");
	expect(response.ok(), await response.text()).toBe(true);
	const session = await response.json();
	expect(session?.user?.role).toBe("admin");
	const { id, email, role, mustChangePassword } = session.user;
	await writeFile(
		sessionSnapshotPath,
		JSON.stringify({ user: { id, email, role, mustChangePassword } }),
	);
	await context.storageState({ path: authStatePath });
} finally {
	await context.dispose();
}
