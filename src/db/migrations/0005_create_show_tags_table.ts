/*
 * show_tags (new table)
 * ┌─────────────────┬─────────┬───────────────────────┐
 * │ Column / change │ Type    │ Constraints / purpose │
 * ├─────────────────┼─────────┼───────────────────────┤
 * │ id              │ integer │ PRIMARY KEY; identity │
 * │ show_id         │ integer │ NOT NULL              │
 * │ tag_id          │ integer │ NOT NULL              │
 * └─────────────────┴─────────┴───────────────────────┘
 *
 * show_tags
 * ┌───────────────────┬────────┬──────────────────────────────────────────────┐
 * │ Column / change   │ Type   │ Constraints / purpose                        │
 * ├───────────────────┼────────┼──────────────────────────────────────────────┤
 * │ (show_id, tag_id) │ unique │ One row per pair                             │
 * │ tag_id            │ index  │ Reverse lookup; foreign keys cascade deletes │
 * └───────────────────┴────────┴──────────────────────────────────────────────┘
 */
import type { Kysely } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("show_tags")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("show_id", "integer", (c) => c.notNull())
		.addColumn("tag_id", "integer", (c) => c.notNull())
		.addForeignKeyConstraint(
			"show_tags_show_id_fkey",
			["show_id"],
			"shows",
			["id"],
			(c) => c.onDelete("cascade"),
		)
		.addForeignKeyConstraint(
			"show_tags_tag_id_fkey",
			["tag_id"],
			"tags",
			["id"],
			(c) => c.onDelete("cascade"),
		)
		.addUniqueConstraint("show_tags_show_id_tag_id_unique", [
			"show_id",
			"tag_id",
		])
		.execute();

	// The unique constraint starts with show_id, so add a separate index for
	// finding every show associated with a given tag.
	// Example: SELECT show_id FROM show_tags WHERE tag_id = 2;
	await db.schema
		.createIndex("show_tags_tag_id_idx")
		.on("show_tags")
		.column("tag_id")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("show_tags").execute();
}
