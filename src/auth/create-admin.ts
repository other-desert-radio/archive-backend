import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { db } from "../db/db.js";
import { AccountError } from "./access.js";
import { normalizeAccountEmail, validatePassword } from "./accounts.js";
import { createAuth } from "./auth.js";
import { lockAccountManagement } from "./security.js";

const readPassword = (prompt: string): Promise<string> => {
	if (!stdin.isTTY || !stdout.isTTY)
		throw new Error("Run scripts/create-admin in an interactive terminal");
	stdout.write(prompt);
	stdin.setRawMode(true);
	stdin.resume();
	stdin.setEncoding("utf8");
	return new Promise((resolve, reject) => {
		let value = "";
		const finish = () => {
			stdin.off("data", onData);
			stdin.setRawMode(false);
			stdin.pause();
			stdout.write("\n");
		};
		const onData = (chunk: string) => {
			for (const character of chunk) {
				if (character === "\u0003") {
					finish();
					reject(new Error("Cancelled"));
					return;
				}
				if (character === "\r" || character === "\n") {
					finish();
					resolve(value);
					return;
				}
				if (character === "\u007f" || character === "\b")
					value = Array.from(value).slice(0, -1).join("");
				else if (character >= " ") value += character;
			}
		};
		stdin.on("data", onData);
	});
};

try {
	if (!stdin.isTTY || !stdout.isTTY)
		throw new Error("Run scripts/create-admin in an interactive terminal");
	const existing = await db
		.selectFrom("user")
		.select("id")
		.where("role", "=", "admin")
		.executeTakeFirst();
	if (existing)
		throw new Error(
			"An administrator already exists. Use account management to add accounts",
		);
	const terminal = createInterface({ input: stdin, output: stdout });
	const email = normalizeAccountEmail(
		await terminal.question("Administrator email: "),
	);
	terminal.close();
	const password = validatePassword(
		await readPassword("Password (8–128 characters; hidden): "),
	);
	const confirmation = await readPassword("Confirm password (hidden): ");
	if (password !== confirmation) throw new Error("Passwords do not match");
	await db.transaction().execute(async (transaction) => {
		await lockAccountManagement(transaction);
		const existing = await transaction
			.selectFrom("user")
			.select("id")
			.where("role", "=", "admin")
			.executeTakeFirst();
		if (existing)
			throw new AccountError(409, "An administrator already exists");
		await createAuth(transaction).api.createUser({
			body: {
				email,
				password,
				name: email,
				role: "admin",
				data: { mustChangePassword: false },
			},
		});
	});
	console.log("Administrator created. Sign in through /admin.");
} catch (error) {
	console.error(
		error instanceof Error
			? error.message
			: "Unable to provision administrator",
	);
	process.exitCode = 1;
} finally {
	await db.destroy();
}
