import { describe, expect, test } from "bun:test";
import {
	parseAccountCommand,
	runAccountCommand,
} from "../../src/auth/operator-command.js";
import {
	normalizeAccountEmail,
	validateAccountPassword,
} from "../../src/auth/index.js";

describe("operator account commands", () => {
	test("normalizes identity and rejects malformed or secret-bearing arguments", () => {
		expect(
			parseAccountCommand([
				"create",
				"--email",
				" ADMIN@example.test ",
				"--name",
				" Admin ",
			]),
		).toEqual({ action: "create", email: "admin@example.test", name: "Admin" });
		expect(
			parseAccountCommand(["reset", "--email", "ADMIN@example.test"]),
		).toEqual({ action: "reset", email: "admin@example.test" });
		for (const args of [
			["create", "--email", "admin@example.test"],
			[
				"reset",
				"--email",
				"admin@example.test",
				"--password",
				"never-print-this",
			],
			["reset", "--email", "admin@example.test", "--name", "Admin"],
			["create", "extra"],
			["delete", "--email", "admin@example.test"],
		])
			expect(() => parseAccountCommand(args)).toThrow();
		expect(() => normalizeAccountEmail("not an email")).toThrow();
		expect(() => validateAccountPassword("short")).toThrow();
		expect(() => validateAccountPassword("a".repeat(129))).toThrow();
	});
	test("mismatched or cancelled prompts never invoke persistence", async () => {
		let calls = 0;
		const command = parseAccountCommand([
			"reset",
			"--email",
			"admin@example.test",
		]);
		const responses = ["valid-password", "other-password"];
		await expect(
			runAccountCommand(command, {
				prompt: async () => responses.shift() ?? "",
				execute: async () => {
					calls++;
				},
				log: () => {},
			}),
		).rejects.toThrow("Passwords do not match");
		await expect(
			runAccountCommand(command, {
				prompt: async () => {
					throw new Error("Cancelled");
				},
				execute: async () => {
					calls++;
				},
				log: () => {},
			}),
		).rejects.toThrow("Cancelled");
		expect(calls).toBe(0);
	});
	test("passes confirmed password to persistence without logging it", async () => {
		const messages: string[] = [];
		let received = "";
		await runAccountCommand(
			parseAccountCommand([
				"create",
				"--email",
				"admin@example.test",
				"--name",
				"Admin",
			]),
			{
				prompt: async () => "secret-never-log",
				execute: async (_command, password) => {
					received = password;
				},
				log: (message) => messages.push(message),
			},
		);
		expect(received).toBe("secret-never-log");
		expect(messages.join("\n")).not.toContain(received);
		expect(messages.at(-1)).toContain("succeeded");
	});
});
