import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Adds optional Mixcloud genre identifiers and URLs to tags. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("tags")
		.addColumn("mixcloud_key", "text")
		.addColumn("mixcloud_url", "text")
		.execute();
}

/** Removes optional Mixcloud genre identifiers and URLs from tags. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("tags")
		.dropColumn("mixcloud_url")
		.dropColumn("mixcloud_key")
		.execute();
}
