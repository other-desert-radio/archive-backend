import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/*
 * Show DJs Database:
 *
 * +---------+---------+---------------------------+
 * | column  | type    | constraints                |
 * +---------+---------+---------------------------+
 * | id      | integer | primary key                |
 * | show_id | integer | not null, references shows |
 * | dj_id   | integer | not null, references djs   |
 * +---------+---------+---------------------------+
 */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("show_djs")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("show_id", "integer", (c) => c.notNull())
		.addColumn("dj_id", "integer", (c) => c.notNull())
		.addForeignKeyConstraint(
			"show_djs_show_id_fkey",
			["show_id"],
			"shows",
			["id"],
			(c) => c.onDelete("cascade"),
		)
		.addForeignKeyConstraint(
			"show_djs_dj_id_fkey",
			["dj_id"],
			"djs",
			["id"],
			(c) => c.onDelete("cascade"),
		)
		.addUniqueConstraint("show_djs_show_id_dj_id_unique", ["show_id", "dj_id"])
		.execute();

	// The unique constraint starts with show_id, so add a separate index for
	// finding every show associated with a given DJ.
	await db.schema
		.createIndex("show_djs_dj_id_idx")
		.on("show_djs")
		.column("dj_id")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("show_djs").execute();
}
