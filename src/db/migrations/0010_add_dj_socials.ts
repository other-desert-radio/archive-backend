import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Adds the optional formatted social-links field to DJs. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("djs").addColumn("socials", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("djs").dropColumn("socials").execute();
}
