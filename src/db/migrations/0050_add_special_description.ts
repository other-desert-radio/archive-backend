/*
 * specials (added columns)
 * ┌─────────────────┬──────┬────────────────────────────────────┐
 * │ Column / change │ Type │ Constraints / purpose              │
 * ├─────────────────┼──────┼────────────────────────────────────┤
 * │ description     │ text │ Nullable; sanitized HTML like bio  │
 * └─────────────────┴──────┴────────────────────────────────────┘
 * Existing rows retain their data and start with NULL descriptions.
 * Rollback drops the column and loses all stored Special descriptions.
 */
import type { Kysely } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("specials")
		.addColumn("description", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("specials").dropColumn("description").execute();
}
