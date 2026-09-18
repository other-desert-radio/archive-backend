import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Adds optional show metadata to DJs. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.addColumn("showTitle", "text")
		.addColumn("showDescription", "text")
		.execute();
}

/** Removes optional show metadata from DJs. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.dropColumn("showDescription")
		.dropColumn("showTitle")
		.execute();
}
