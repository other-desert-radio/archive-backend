import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Retains source tag keys and gives each Mixcloud genre one archive tag. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("tags")
		.addUniqueConstraint("tags_mixcloud_key_unique", ["mixcloud_key"])
		.execute();
	await db.schema
		.alterTable("mixcloud_import")
		.addColumn("mixcloud_tag_keys", sql`text[]`)
		.execute();
}

/** Removes source tag keys and restores non-unique genre metadata. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.dropColumn("mixcloud_tag_keys")
		.execute();
	await db.schema
		.alterTable("tags")
		.dropConstraint("tags_mixcloud_key_unique")
		.execute();
}
