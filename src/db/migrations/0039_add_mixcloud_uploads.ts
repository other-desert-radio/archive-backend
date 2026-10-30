/*
 * mixcloud_uploads (new table)
 * ┌─────────────────┬─────────────┬──────────────────────────────────────────┐
 * │ Column / change │ Type        │ Constraints / purpose                    │
 * ├─────────────────┼─────────────┼──────────────────────────────────────────┤
 * │ id              │ integer     │ PRIMARY KEY; identity                    │
 * │ createdAt       │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP      │
 * │ created_by      │ text        │ Nullable; FK user.id ON DELETE SET NULL  │
 * │ mixcloud_key    │ text        │ NOT NULL; UNIQUE                         │
 * │ title           │ text        │ NOT NULL                                 │
 * │ description     │ text        │ Nullable                                 │
 * │ date            │ timestamptz │ NOT NULL                                 │
 * │ djs             │ integer[]   │ NOT NULL                                 │
 * │ mixcloud_title  │ text        │ NOT NULL                                 │
 * │ tags            │ text[]      │ NOT NULL                                 │
 * │ mixcloud_data   │ jsonb       │ Nullable                                 │
 * │ show_id         │ integer     │ Nullable; FK shows.id ON DELETE SET NULL │
 * └─────────────────┴─────────────┴──────────────────────────────────────────┘
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("mixcloud_uploads")
		.addColumn("id", "integer", (column) =>
			column.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("createdAt", "timestamptz", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("created_by", "text", (column) =>
			column.references("user.id").onDelete("set null"),
		)
		.addColumn("mixcloud_key", "text", (column) => column.notNull().unique())
		.addColumn("title", "text", (column) => column.notNull())
		.addColumn("description", "text")
		.addColumn("date", "timestamptz", (column) => column.notNull())
		.addColumn("djs", sql`integer[]`, (column) => column.notNull())
		.addColumn("mixcloud_title", "text", (column) => column.notNull())
		.addColumn("tags", sql`text[]`, (column) => column.notNull())
		.addColumn("mixcloud_data", "jsonb")
		.addColumn("show_id", "integer", (column) =>
			column.references("shows.id").onDelete("set null"),
		)
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("mixcloud_uploads").execute();
}
