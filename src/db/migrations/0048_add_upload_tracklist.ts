/** Pending upload tracklists survive reloads. Rollback loses pending tracklists. */
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
