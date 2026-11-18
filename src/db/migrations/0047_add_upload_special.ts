/**
 * mixcloud_uploads
 * ┌───────────────────┬─────────────┬─────────────────────────────────────────┐
 * │ Column            │ Type        │ Change                                  │
 * ├───────────────────┼─────────────┼─────────────────────────────────────────┤
 * │ special_id        │ integer     │ Nullable FK; DELETE SET NULL            │
 * └───────────────────┴─────────────┴─────────────────────────────────────────┘
 * Existing uploads remain unassigned. Rollback loses pending special selections.
 */
import type { Kysely } from "kysely";
import type { Database } from "../types.js";
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_uploads")
		.addColumn("special_id", "integer", (c) =>
			c.references("specials.id").onDelete("set null"),
		)
		.execute();
}
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_uploads")
		.dropColumn("special_id")
		.execute();
}
