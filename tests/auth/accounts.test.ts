import { describe, expect, test } from "bun:test";
import {
	normalizeAccountEmail,
	protectAdministrator,
	requireAccountBody,
	validatePassword,
} from "../../src/auth/accounts.js";

describe("account inputs and administrator safety", () => {
	test("normalizes emails and rejects malformed emails", () => {
		expect(normalizeAccountEmail("  STAFF@Example.com  ")).toBe(
			"staff@example.com",
		);
		for (const value of [undefined, "invalid", "a@b", "a b@example.com"])
			expect(() => normalizeAccountEmail(value)).toThrow("valid email");
	});
	test("retains spaces and enforces password length", () => {
		const spaced = "  a long passphrase  ";
		expect(validatePassword(spaced)).toBe(spaced);
		expect(validatePassword("x".repeat(8))).toHaveLength(8);
		expect(validatePassword("x".repeat(128))).toHaveLength(128);
		for (const value of [null, 12, "x".repeat(7), "x".repeat(129)])
			expect(() => validatePassword(value)).toThrow("8–128");
	});
	test("rejects non-object request bodies", () => {
		for (const value of [null, undefined, [], "password"])
			expect(() => requireAccountBody(value)).toThrow("request body");
	});
	test("rejects self-removal before database access", async () => {
		await expect(
			protectAdministrator(
				{} as never,
				{
					id: "self",
					email: "self@example.com",
					role: "admin",
					mustChangePassword: false,
				},
				"self",
			),
		).rejects.toThrow("own account");
	});
	test("protects the final administrator", async () => {
		const database = {
			selectFrom: () => {
				const query = {
					select: () => query,
					where: () => query,
					execute: async () => [{ id: "last" }],
				};
				return query;
			},
		};
		await expect(
			protectAdministrator(
				database as never,
				{
					id: "last",
					email: "last@example.com",
					role: "admin",
					mustChangePassword: false,
				},
				"other",
			),
		).rejects.toThrow("last administrator");
	});
});
