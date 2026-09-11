import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/*
 * DJ Tags Database:
 *
 * +--------+---------+--------------------------+
 * | column | type    | constraints               |
 * +--------+---------+--------------------------+
 * | id     | integer | primary key               |
 * | dj_id  | integer | not null, references djs  |
 * | tag_id | integer | not null, references tags |
 * +--------+---------+--------------------------+
 */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("dj_tags")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("dj_id", "integer", (c) => c.notNull())
		.addColumn("tag_id", "integer", (c) => c.notNull())
		.addForeignKeyConstraint(
			"dj_tags_dj_id_fkey",
			["dj_id"],
			"djs",
			["id"],
			(c) => c.onDelete("cascade"),
		)
		.addForeignKeyConstraint(
			"dj_tags_tag_id_fkey",
			["tag_id"],
			"tags",
			["id"],
			(c) => c.onDelete("cascade"),
		)
		.addUniqueConstraint("dj_tags_dj_id_tag_id_unique", ["dj_id", "tag_id"])
		.execute();

	// The unique constraint starts with dj_id, so add a separate index for
	// finding every DJ associated with a given tag.
	// Example: SELECT dj_id FROM dj_tags WHERE tag_id = 2;
	await db.schema
		.createIndex("dj_tags_tag_id_idx")
		.on("dj_tags")
		.column("tag_id")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("dj_tags").execute();
}
