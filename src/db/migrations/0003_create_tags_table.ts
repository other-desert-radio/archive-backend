/*
 * tags (new table)
 * ┌─────────────────┬─────────┬───────────────────────┐
 * │ Column / change │ Type    │ Constraints / purpose │
 * ├─────────────────┼─────────┼───────────────────────┤
 * │ id              │ integer │ PRIMARY KEY; identity │
 * │ name            │ text    │ NOT NULL              │
 * │ color           │ text    │ Nullable              │
 * └─────────────────┴─────────┴───────────────────────┘
 */
import type { Kysely } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("tags")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("name", "text", (c) => c.notNull())
		.addColumn("color", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("tags").execute();
}
