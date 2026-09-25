import {
	AccountOperationError,
	createAdminAccount,
	resetAdminPassword,
} from "./index.js";
import { parseAccountCommand, runAccountCommand } from "./operator-command.js";
import { promptPassword } from "./password-prompt.js";

try {
	const command = parseAccountCommand(process.argv.slice(2));
	await runAccountCommand(command, {
		prompt: promptPassword,
		log: (message) => console.info(message),
		execute: async (selected, password) => {
			const { db } = await import("../db/db.js");
			try {
				if (selected.action === "create") {
					await createAdminAccount(db, {
						email: selected.email,
						name: selected.name ?? "",
						password,
					});
				} else {
					const result = await resetAdminPassword(db, {
						email: selected.email,
						password,
					});
					console.info(
						`[Admin Accounts] sessions revoked -- userId: ${result.id}, count: ${result.revokedSessions}`,
					);
				}
			} finally {
				await db.destroy();
			}
		},
	});
} catch (error) {
	// Never print arbitrary exceptions: drivers may include connection strings or SQL values.
	console.error(
		`[Admin Accounts] rejected or failed -- ${error instanceof AccountOperationError ? error.message : "Account operation failed. Check database connectivity and applied migrations."}`,
	);
	process.exitCode = 1;
}
