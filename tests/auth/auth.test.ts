import { afterAll, describe, expect, test } from "bun:test";
import { buildApp } from "../../src/app.js";
import { Pool } from "pg";
import { createAuth } from "../../src/auth/index.js";

const pool = new Pool({
	connectionString: "postgres://auth-test:auth-test@127.0.0.1:1/auth-test",
});
const auth = createAuth({
	database: pool,
	secret: "test-secret-that-is-at-least-32-characters-long",
	baseURL: "http://localhost:3000",
	validateSchema: false,
});

afterAll(async () => {
	await pool.end();
});

describe("Better Auth configuration", () => {
	test("enables email/password authentication without public sign-up", () => {
		expect(auth.options.emailAndPassword?.enabled).toBe(true);
		expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
		expect(auth.options.user?.additionalFields?.role?.input).toBe(false);
		expect(auth.options.user?.additionalFields?.role?.defaultValue).toBe(
			"admin",
		);
	});

	test("serves session and sign-out endpoints through the configured instance", async () => {
		const app = buildApp(auth);

		const signInResponse = await app.inject({
			method: "POST",
			url: "/api/auth/sign-in/email",
			payload: { email: "not-an-email" },
		});
		expect(signInResponse.statusCode).toBe(400);

		const sessionResponse = await app.inject({
			method: "GET",
			url: "/api/auth/get-session",
		});
		expect(sessionResponse.statusCode).toBe(200);
		expect(sessionResponse.json()).toBeNull();

		const signOutResponse = await app.inject({
			method: "POST",
			url: "/api/auth/sign-out",
			payload: {},
		});
		expect(signOutResponse.statusCode).toBe(200);
		expect(signOutResponse.json().success).toBe(true);

		await app.close();
	});
});
