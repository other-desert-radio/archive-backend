import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Retain original tag names alongside keys; existing rows require source refresh. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.addColumn("mixcloud_tags", "jsonb")
		.execute();
	await sql`ALTER TABLE mixcloud_import ADD CONSTRAINT mixcloud_tags_array CHECK (mixcloud_tags IS NULL OR jsonb_typeof(mixcloud_tags) = 'array')`.execute(
		db,
	);
}
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.dropColumn("mixcloud_tags")
		.execute();
}
