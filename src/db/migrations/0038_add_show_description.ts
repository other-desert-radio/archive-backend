/*
 * shows (added columns)
 * ┌─────────────────┬──────┬───────────────────────┐
 * │ Column / change │ Type │ Constraints / purpose │
 * ├─────────────────┼──────┼───────────────────────┤
 * │ description     │ text │ Nullable              │
 * └─────────────────┴──────┴───────────────────────┘
 */
import type { Kysely } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.addColumn("description", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("shows").dropColumn("description").execute();
}
