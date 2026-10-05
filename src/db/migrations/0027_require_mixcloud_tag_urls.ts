import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Require refreshed source tags to include string URLs without changing data. */
export async function up(db: Kysely<Database>): Promise<void> {
	await sql`ALTER TABLE mixcloud_import
		ADD CONSTRAINT mixcloud_tag_urls_required CHECK (
			mixcloud_tags IS NULL OR NOT jsonb_path_exists(
				mixcloud_tags, '$[*] ? (!exists(@.url) || @.url.type() != "string")'
			)
		)`.execute(db);
}

/** Allow legacy tags without URLs again, preserving all source metadata. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.dropConstraint("mixcloud_tag_urls_required")
		.execute();
}
