import assert from "node:assert/strict";
import { sql } from "kysely";
import { auth } from "../src/auth/auth.js";
import { db } from "../src/db/db.js";
import {
	down,
	up,
} from "../src/db/migrations/0028_complete_account_authentication.js";

// Run only in the disposable integration database, never the normal archive.
if (process.env.INTEGRATION_AUTH_SEED !== "disposable") {
	throw new Error("INTEGRATION_AUTH_SEED=disposable is required");
}
try {
	await db.transaction().execute(async (transaction) => {
		await down(transaction);
		await sql`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role) values ('migration-probe', 'Migration probe', ' Legacy@Example.Test ', false, now(), now(), null)`.execute(
			transaction,
		);
		await up(transaction);
		const legacy = await transaction
			.selectFrom("user")
			.select(["email", "role", "mustChangePassword"])
			.where("id", "=", "migration-probe")
			.executeTakeFirstOrThrow();
		assert.deepEqual(legacy, {
			email: "legacy@example.test",
			role: "admin",
			mustChangePassword: false,
		});
		await transaction
			.deleteFrom("user")
			.where("id", "=", "migration-probe")
			.execute();
	});
	await assert.rejects(
		db.transaction().execute(async (transaction) => {
			await down(transaction);
			await sql`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values ('collision-a', 'A', 'collision@example.test', false, now(), now()), ('collision-b', 'B', ' COLLISION@example.test ', false, now(), now())`.execute(
				transaction,
			);
			await up(transaction);
		}),
		/duplicate key|unique/i,
	);
	const email = "integration-admin@example.test";
	const existing = await db
		.selectFrom("user")
		.select("id")
		.where("email", "=", email)
		.executeTakeFirst();
	if (!existing) {
		await auth.api.createUser({
			body: {
				email,
				name: email,
				password: "integration admin password 2026",
				role: "admin",
				data: { mustChangePassword: false },
			},
		});
	}
} finally {
	await db.destroy();
}
