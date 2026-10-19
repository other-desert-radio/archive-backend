import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { adminCredentials, authOrigin, signIn } from "./auth-fixtures.js";

test.describe.configure({ mode: "serial" });

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

test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://api:3000" });

const password = "initial editor password 2026";
const changedPassword = "replacement editor password 2026";

test("@auth login, account lifecycle, roles and session revocation", async ({
	playwright,
	baseURL,
}) => {
	const admin = await playwright.request.newContext({
		baseURL,
		extraHTTPHeaders: { origin: authOrigin },
	});
	const editor = await playwright.request.newContext({
		baseURL,
		extraHTTPHeaders: { origin: authOrigin },
	});
	const anonymous = await playwright.request.newContext({
		baseURL,
		extraHTTPHeaders: { origin: authOrigin },
	});
	let id: string | undefined;
	try {
		expect((await anonymous.get("/api/admin/users")).status()).toBe(401);
		expect((await anonymous.get("/admin/")).status()).toBe(200);
		const invalid = await anonymous.post("/api/auth/sign-in/email", {
			data: { ...adminCredentials, password: "incorrect password" },
		});
		expect(invalid.ok()).toBe(false);
		expect(
			(
				await anonymous.post("/api/auth/sign-up/email", {
					data: { email: "public@example.test", password, name: "Public" },
				})
			).ok(),
		).toBe(false);
		await signIn(admin);
		const current = await (await admin.get("/api/auth/get-session")).json();
		expect(
			(
				await admin.post("/api/admin/reset-user-password", {
					data: { id: current.user.id, password },
				})
			).ok(),
		).toBe(false);
		expect(
			(
				await admin.post("/api/admin/remove-user", {
					data: { id: current.user.id },
				})
			).ok(),
		).toBe(false);
		expect(
			(
				await admin.post("/api/admin/modify-user-role", {
					data: { id: current.user.id, role: "editor" },
				})
			).ok(),
		).toBe(false);
		expect(
			(
				await admin.post("/api/admin/create-user", {
					headers: { origin: "https://attacker.example" },
					data: { email: "csrf@example.test", password, role: "editor" },
				})
			).status(),
		).toBe(403);
		const email = `integration-${randomUUID()}@example.test`;
		const created = await admin.post("/api/admin/create-user", {
			data: { email, password, role: "editor" },
		});
		expect(created.ok(), await created.text()).toBe(true);
		const user = await created.json();
		id = user.id;
		const database = new Pool({ connectionString: process.env.DATABASE_URL });
		try {
			const stored = await database.query(
				'select password from account where "userId" = $1',
				[id],
			);
			expect(stored.rows).toHaveLength(1);
			expect(stored.rows[0].password).toBeTruthy();
			expect(stored.rows[0].password).not.toBe(password);
		} finally {
			await database.end();
		}
		expect(user).toMatchObject({
			email,
			role: "editor",
			mustChangePassword: true,
		});
		expect(JSON.stringify(user)).not.toContain(password);
		await signIn(editor, email, password);
		const blocked = await editor.get("/api/admin/tags");
		expect(blocked.status()).toBe(403);
		expect((await blocked.json()).code).toBe("PASSWORD_CHANGE_REQUIRED");
		// Compatibility characters verify as the same password in Better Auth.
		const equivalentPassword = password.replace(/[a-z]/g, (character) =>
			String.fromCharCode(character.charCodeAt(0) + 0xfee0),
		);
		expect(
			(
				await editor.post("/api/account/change-password", {
					data: { currentPassword: password, newPassword: equivalentPassword },
				})
			).status(),
		).toBe(400);
		expect(
			(
				await editor.post("/api/account/change-password", {
					data: { currentPassword: password, newPassword: changedPassword },
				})
			).ok(),
		).toBe(true);
		// Password changes may rotate/revoke the current session; authenticate again.
		await signIn(editor, email, changedPassword);
		expect((await editor.get("/api/admin/tags")).status()).toBe(200);
		expect((await editor.get("/api/admin/users")).status()).toBe(403);
		expect(
			(
				await editor.post("/api/admin/create-user", {
					data: { email: `denied-${email}`, password, role: "admin" },
				})
			).status(),
		).toBe(403);
		expect(
			(
				await editor.post("/api/auth/admin/set-role", {
					data: { userId: id, role: "admin" },
				})
			).ok(),
		).toBe(false);
		expect(
			(
				await editor.post("/api/auth/change-password", {
					data: { currentPassword: changedPassword, newPassword: password },
				})
			).ok(),
		).toBe(false);
		const promoted = await admin.post("/api/admin/modify-user-role", {
			data: { id, role: "admin" },
		});
		expect(promoted.ok(), await promoted.text()).toBe(true);
		expect((await editor.get("/api/admin/tags")).status()).toBe(401);
		await clearRateLimits();
		await signIn(editor, email, changedPassword);
		expect((await editor.get("/api/admin/users")).status()).toBe(200);
		expect(
			(
				await admin.post("/api/admin/reset-user-password", {
					data: { id, password },
				})
			).ok(),
		).toBe(true);
		expect((await editor.get("/api/admin/users")).status()).toBe(401);
		await signIn(editor, email, password);
		expect((await editor.get("/api/admin/tags")).status()).toBe(403);
		expect(
			(await admin.post("/api/admin/remove-user", { data: { id } })).ok(),
		).toBe(true);
		const cascadeCheck = new Pool({
			connectionString: process.env.DATABASE_URL,
		});
		try {
			expect(
				(
					await cascadeCheck.query(
						'select id from account where "userId" = $1 union all select id from session where "userId" = $1',
						[id],
					)
				).rows,
			).toHaveLength(0);
		} finally {
			await cascadeCheck.end();
		}
		id = undefined;
		expect((await editor.get("/api/admin/tags")).status()).toBe(401);
		await admin.post("/api/auth/sign-out");
		expect((await admin.get("/api/admin/users")).status()).toBe(401);
	} finally {
		if (id) {
			await signIn(admin);
			await admin.post("/api/admin/remove-user", { data: { id } });
		}
		await Promise.all([admin.dispose(), editor.dispose(), anonymous.dispose()]);
	}
});

test("@auth login form is accessible and retains failed email", async ({
	page,
}) => {
	await page.goto("/admin/");
	await page.getByLabel("email", { exact: true }).fill(adminCredentials.email);
	await page.getByLabel("password", { exact: true }).fill("incorrect password");
	await page.getByRole("button", { name: /^sign in$/i }).click();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByLabel("email", { exact: true })).toHaveValue(
		adminCredentials.email,
	);
	await page
		.getByLabel("password", { exact: true })
		.fill(adminCredentials.password);
	await page.getByRole("button", { name: /^sign in$/i }).click();
	await expect(
		page.getByRole("complementary", { name: "Admin navigation" }),
	).toBeVisible();
});

test("@auth sixth login attempt within one minute is rate limited", async ({
	request,
}) => {
	for (let attempt = 0; attempt < 5; attempt++) {
		const response = await request.post("/api/auth/sign-in/email", {
			headers: { origin: authOrigin },
			data: {
				email: adminCredentials.email,
				password: "invalid integration password",
			},
		});
		expect(response.status()).not.toBe(429);
	}
	const limited = await request.post("/api/auth/sign-in/email", {
		headers: { origin: authOrigin },
		data: adminCredentials,
	});
	expect(limited.status()).toBe(429);
});

test("@auth concurrent administrators cannot both demote each other", async ({
	playwright,
	baseURL,
}) => {
	const contexts = await Promise.all(
		Array.from({ length: 3 }, () =>
			playwright.request.newContext({
				baseURL,
				extraHTTPHeaders: { origin: authOrigin },
			}),
		),
	);
	const [owner, first, second] = contexts;
	if (!owner || !first || !second) throw new Error("Missing test contexts");
	const database = new Pool({ connectionString: process.env.DATABASE_URL });
	const ids: string[] = [];
	try {
		await signIn(owner);
		const emails = [
			`first-${randomUUID()}@example.test`,
			`second-${randomUUID()}@example.test`,
		];
		for (const email of emails) {
			const created = await owner.post("/api/admin/create-user", {
				data: { email, password, role: "admin" },
			});
			expect(created.ok(), await created.text()).toBe(true);
			ids.push((await created.json()).id);
		}
		// Fixture-only preparation isolates actor revocation from forced-change behavior.
		await database.query(
			'update "user" set "mustChangePassword" = false where id = any($1::text[])',
			[ids],
		);
		await signIn(first, emails[0], password);
		await signIn(second, emails[1], password);
		const results = await Promise.all([
			first.post("/api/admin/modify-user-role", {
				data: { id: ids[1], role: "editor" },
			}),
			second.post("/api/admin/modify-user-role", {
				data: { id: ids[0], role: "editor" },
			}),
		]);
		expect(results.map((result) => result.status()).sort()).toEqual([200, 401]);
		const roles = await database.query(
			'select role from "user" where id = any($1::text[]) order by role',
			[ids],
		);
		expect(roles.rows.map((row) => row.role)).toEqual(["admin", "editor"]);
	} finally {
		for (const id of ids)
			await owner.post("/api/admin/remove-user", { data: { id } });
		await database.end();
		await Promise.all(contexts.map((context) => context.dispose()));
	}
});
