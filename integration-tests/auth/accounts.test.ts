import { afterAll, expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { buildApp } from "../../src/app.js";
import {
	createAdminAccount,
	createAuth,
	resetAdminPassword,
} from "../../src/auth/index.js";
import type { Database } from "../../src/db/types.js";

const connectionString = process.env.AUTH_INTEGRATION_DATABASE_URL;
if (!connectionString)
	throw new Error(
		"Run scripts/run-integration-tests --auth-only with its disposable database.",
	);
const pool = new Pool({ connectionString });
const database = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});
const app = buildApp(
	createAuth({
		database: pool,
		secret: "isolated-auth-test-secret-at-least-32-characters",
		baseURL: "http://localhost:3000",
	}),
);
afterAll(async () => {
	await app.close();
	await database.destroy();
});
const password = "original-test-password";
const login = (email: string, selectedPassword = password) =>
	app.inject({
		method: "POST",
		url: "/api/auth/sign-in/email",
		payload: { email, password: selectedPassword },
	});
const cookieFrom = (response: Awaited<ReturnType<typeof login>>) => {
	const cookies = response.headers["set-cookie"];
	return (Array.isArray(cookies) ? cookies : [cookies ?? ""])
		.map((value) => value.split(";")[0])
		.join("; ");
};
const access = (cookie: string) =>
	app.inject({ method: "GET", url: "/api/admin", headers: { cookie } });

test("provisioning, real login, logout and reset revoke cookies without overwriting accounts", async () => {
	const email = "first@example.test";
	const first = await createAdminAccount(database, {
		email: " First@Example.test ",
		name: "First",
		password,
	});
	await createAdminAccount(database, {
		email: "second@example.test",
		name: "Second",
		password,
	});
	await expect(
		createAdminAccount(database, {
			email,
			name: "Overwrite",
			password: "different-password",
		}),
	).rejects.toThrow("already exists");
	expect((await login(email, "wrong-password")).statusCode).toBe(401);
	const signedIn = await login(email);
	expect(signedIn.statusCode).toBe(200);
	const cookie = cookieFrom(signedIn);
	expect(cookie).toContain("session_token=");
	expect((await access(cookie)).statusCode).toBe(200);
	const second = await login("second@example.test");
	expect(second.statusCode).toBe(200);
	const logout = await app.inject({
		method: "POST",
		url: "/api/auth/sign-out",
		headers: { cookie },
		payload: {},
	});
	expect(logout.statusCode).toBe(200);
	expect((await access(cookie)).statusCode).toBe(401);
	const oldCookie = cookieFrom(await login(email));
	const reset = await resetAdminPassword(database, {
		email,
		password: "replacement-password",
	});
	expect(reset.id).toBe(first.id);
	expect(reset.revokedSessions).toBe(1);
	expect((await access(oldCookie)).statusCode).toBe(401);
	expect((await login(email)).statusCode).toBe(401);
	expect((await login(email, "replacement-password")).statusCode).toBe(200);
	expect((await access(cookieFrom(second))).statusCode).toBe(200);
	const signup = await app.inject({
		method: "POST",
		url: "/api/auth/sign-up/email",
		payload: { email: "signup@example.test", name: "Signup", password },
	});
	expect(signup.statusCode).toBe(400);
	expect(
		await database
			.selectFrom("user")
			.selectAll()
			.where("email", "=", "signup@example.test")
			.execute(),
	).toHaveLength(0);
});

test("failed credential insertion rolls back the user; failed revocation rolls back reset", async () => {
	await createAdminAccount(database, {
		email: "rollback-login@example.test",
		name: "Rollback",
		password,
	});
	// A temporary trigger forces a database failure after the first write.
	await sql`create function reject_auth_write() returns trigger language plpgsql as $$ begin raise exception 'fixture failure'; end $$`.execute(
		database,
	);
	await sql`create trigger reject_account before insert on account for each row execute function reject_auth_write()`.execute(
		database,
	);
	try {
		await expect(
			createAdminAccount(database, {
				email: "rollback@example.test",
				name: "Rollback",
				password,
			}),
		).rejects.toThrow();
		expect(
			await database
				.selectFrom("user")
				.selectAll()
				.where("email", "=", "rollback@example.test")
				.execute(),
		).toHaveLength(0);
	} finally {
		await sql`drop trigger reject_account on account`.execute(database);
	}
	const cookie = cookieFrom(await login("rollback-login@example.test"));
	await sql`create trigger reject_session before delete on session for each row execute function reject_auth_write()`.execute(
		database,
	);
	try {
		await expect(
			resetAdminPassword(database, {
				email: "rollback-login@example.test",
				password: "failed-reset-password",
			}),
		).rejects.toThrow();
	} finally {
		await sql`drop trigger reject_session on session`.execute(database);
		await sql`drop function reject_auth_write()`.execute(database);
	}
	expect((await access(cookie)).statusCode).toBe(200);
	expect((await login("rollback-login@example.test")).statusCode).toBe(200);
});

test("expired sessions and non-admin identities cannot access the admin boundary", async () => {
	const user = await createAdminAccount(database, {
		email: "restricted@example.test",
		name: "Restricted",
		password,
	});
	const cookie = cookieFrom(await login(user.email));
	await database
		.updateTable("session")
		.set({ expiresAt: new Date(0) })
		.where("userId", "=", user.id)
		.execute();
	expect((await access(cookie)).statusCode).toBe(401);
	const fresh = cookieFrom(await login(user.email));
	await database
		.updateTable("user")
		.set({ role: "member" })
		.where("id", "=", user.id)
		.execute();
	expect((await access(fresh)).statusCode).toBe(403);
	await expect(
		resetAdminPassword(database, { email: user.email, password }),
	).rejects.toThrow("existing admin");
	await expect(
		resetAdminPassword(database, { email: "missing@example.test", password }),
	).rejects.toThrow("existing admin");
});
