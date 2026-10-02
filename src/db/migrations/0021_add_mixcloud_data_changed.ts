import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Flags imported cloudcasts whose source metadata has changed and needs review.
 * Refresh will set this flag when relevant metadata differs; an unchanged
 * refresh must preserve a set flag until the user reviews and accepts the changes.
 * The flag does not authorize automatic updates to linked Shows or DJs.
 *
 * Existing and new rows start false. Pending imports are identified separately
 * by their null show_id. This migration only adds the flag; refresh change
 * detection and review actions are implemented in later chunks.
 */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.addColumn("data_changed", "boolean", (column) =>
			column.notNull().defaultTo(false),
		)
		.execute();
}

/** Removes only the source-change review flag. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.dropColumn("data_changed")
		.execute();
}
