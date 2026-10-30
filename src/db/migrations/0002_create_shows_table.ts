/*
 * shows (new table)
 * ┌─────────────────┬─────────────┬───────────────────────┐
 * │ Column / change │ Type        │ Constraints / purpose │
 * ├─────────────────┼─────────────┼───────────────────────┤
 * │ id              │ integer     │ PRIMARY KEY; identity │
 * │ title           │ text        │ NOT NULL              │
 * │ date            │ timestamptz │ NOT NULL              │
 * │ duration        │ integer     │ NOT NULL              │
 * │ image           │ text        │ Nullable              │
 * │ url             │ text        │ Nullable              │
 * └─────────────────┴─────────────┴───────────────────────┘
 */
import type { Kysely } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("shows")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("title", "text", (c) => c.notNull())
		.addColumn("date", "timestamptz", (c) => c.notNull())
		.addColumn("duration", "integer", (c) => c.notNull())
		.addColumn("image", "text")
		.addColumn("url", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("shows").execute();
}
