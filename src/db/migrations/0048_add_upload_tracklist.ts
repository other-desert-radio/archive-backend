/**
 * mixcloud_uploads (added column)
 * ┌───────────┬───────┬───────────────────────────────────────────────┐
 * │ Column    │ Type  │ Constraints / purpose                         │
 * ├───────────┼───────┼───────────────────────────────────────────────┤
 * │ tracklist │ jsonb │ NOT NULL; DEFAULT []; validated ordered array │
 * └───────────┴───────┴───────────────────────────────────────────────┘
 * Retains pending tracklists through reloads and archive review. Existing rows
 * get []. The upload_tracklist_shape CHECK reuses shows_tracklist_valid(jsonb)
 * from migration 0044: artist/song or chapter, with nullable whole-second times.
 * Rollback drops the column, losing pending tracklists; saved Shows are unchanged.
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_uploads")
		.addColumn("tracklist", "jsonb", (column) =>
			column.notNull().defaultTo(sql`'[]'::jsonb`),
		)
		.execute();
	await db.schema
		.alterTable("mixcloud_uploads")
		.addCheckConstraint(
			"upload_tracklist_shape",
			sql`shows_tracklist_valid(tracklist)`,
		)
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_uploads")
		.dropColumn("tracklist")
		.execute();
}
