import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Adds current parser suggestions without parsing or backfilling source rows. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.addColumn("derived_title", "text")
		.addColumn("derived_date", "timestamptz")
		.addColumn("decoded_djs", sql`text[]`)
		.addColumn("parser_version", "integer")
		.addColumn("parser_key", "text")
		.addColumn("date_source", "text")
		.execute();
	await db.schema
		.alterTable("mixcloud_import")
		.addCheckConstraint(
			"mixcloud_import_date_source_check",
			sql`date_source IN ('title', 'created_time')`,
		)
		.execute();
}

/** Removes parser suggestions while preserving source records and import links. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.dropConstraint("mixcloud_import_date_source_check")
		.execute();
	await db.schema
		.alterTable("mixcloud_import")
		.dropColumn("date_source")
		.dropColumn("parser_key")
		.dropColumn("parser_version")
		.dropColumn("decoded_djs")
		.dropColumn("derived_date")
		.dropColumn("derived_title")
		.execute();
}
