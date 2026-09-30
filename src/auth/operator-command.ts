import { parseArgs } from "node:util";
import {
	AccountOperationError,
	normalizeAccountEmail,
	validateAccountPassword,
} from "./operator-accounts.js";

export type AccountCommand = {
	action: "create" | "reset";
	email: string;
	name?: string;
};

export const parseAccountCommand = (args: string[]): AccountCommand => {
	let parsed: ReturnType<typeof parseArgs>;
	try {
		parsed = parseArgs({
			args,
			allowPositionals: true,
			strict: true,
			options: {
				email: { type: "string" },
				name: { type: "string" },
			},
		});
	} catch {
		throw new AccountOperationError(
			"Usage: create --email EMAIL --name NAME, or reset --email EMAIL. Password arguments are not accepted.",
		);
	}
	const [action] = parsed.positionals;
	const email = parsed.values.email;
	const name = parsed.values.name;
	if (
		parsed.positionals.length !== 1 ||
		(action !== "create" && action !== "reset") ||
		typeof email !== "string"
	)
		throw new AccountOperationError(
			"Specify create or reset and --email EMAIL.",
		);
	if (action === "create" && (typeof name !== "string" || name.trim() === ""))
		throw new AccountOperationError("Account creation requires --name NAME.");
	if (action === "reset" && name !== undefined)
		throw new AccountOperationError("Password reset does not accept --name.");
	return {
		action,
		email: normalizeAccountEmail(email),
		...(typeof name === "string" ? { name: name.trim() } : {}),
	};
};

/** Shared command flow: confirm secrets before invoking any database mutation. */
export const runAccountCommand = async (
	command: AccountCommand,
	dependencies: {
		prompt: (label: string) => Promise<string>;
		execute: (command: AccountCommand, password: string) => Promise<void>;
		log: (message: string) => void;
	},
): Promise<void> => {
	dependencies.log(
		`[Admin Accounts] ${command.action} requested -- email: ${command.email}`,
	);
	const password = await dependencies.prompt("Password (hidden): ");
	validateAccountPassword(password);
	const confirmation = await dependencies.prompt("Confirm password (hidden): ");
	if (password !== confirmation)
		throw new AccountOperationError(
			"Passwords do not match; no changes were made.",
		);
	await dependencies.execute(command, password);
	dependencies.log(
		`[Admin Accounts] ${command.action} succeeded -- email: ${command.email}`,
	);
};
