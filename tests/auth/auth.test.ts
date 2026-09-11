import { afterAll, describe, expect, test } from "bun:test";

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
	});
});
