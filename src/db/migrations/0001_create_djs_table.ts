/*
 * djs (new table)
 * ┌─────────────────┬─────────┬───────────────────────┐
 * │ Column / change │ Type    │ Constraints / purpose │
 * ├─────────────────┼─────────┼───────────────────────┤
 * │ id              │ integer │ PRIMARY KEY; identity │
 * │ title           │ text    │ NOT NULL              │
 * │ bio             │ text    │ NOT NULL              │
 * │ image           │ text    │ Nullable              │
 * └─────────────────┴─────────┴───────────────────────┘
 */
import type { Kysely } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("djs")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("title", "text", (c) => c.notNull())
		.addColumn("bio", "text", (c) => c.notNull())
		.addColumn("image", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("djs").execute();
}
