import { afterAll, describe, expect, test } from "bun:test";
import { betterAuth } from "better-auth";
import { buildApp } from "../../src/app.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
	"postgres://auth-test:auth-test@localhost:5432/auth-test";
process.env.BETTER_AUTH_SECRET =
	"test-secret-that-is-at-least-32-characters-long";
process.env.BETTER_AUTH_URL = "http://localhost:3000";

const { auth } = await import("../../src/auth/auth.js");
const { pool } = await import("../../src/db/db.js");

afterAll(async () => {
	await pool.end();
});

describe("Better Auth configuration", () => {
	test("enables email/password authentication without public sign-up", () => {
		expect(auth.options.emailAndPassword?.enabled).toBe(true);
		expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
		expect(auth.options.user?.additionalFields?.mustChangePassword?.input).toBe(
			false,
		);
		expect(auth.options.emailAndPassword?.minPasswordLength).toBe(8);
		expect(auth.options.emailAndPassword?.maxPasswordLength).toBe(128);
		expect(auth.options.session?.expiresIn).toBe(604800);
		expect(auth.options.session?.cookieCache?.enabled).toBe(false);
		expect(auth.options.rateLimit?.storage).toBe("database");
		expect(
			auth.options.plugins?.find((plugin) => plugin.id === "admin")?.options
				.defaultRole,
		).toBe("editor");
	});

	test("serves session and sign-out endpoints through the configured instance", async () => {
		// Isolate transport/config coverage from the disposable database integration suite.
		const isolatedAuth = betterAuth({
			...auth.options,
			rateLimit: { enabled: false },
		});
		const app = buildApp(isolatedAuth);

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
