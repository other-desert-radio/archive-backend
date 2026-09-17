import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Adds review status to tags created by admins or DJ onboarding. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("tags")
		.addColumn("reviewed", "boolean", (column) =>
			column.defaultTo(false).notNull(),
		)
		.execute();
}

/** Removes tag review status. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("tags").dropColumn("reviewed").execute();
}
