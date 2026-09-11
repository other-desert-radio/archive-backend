import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Adds the server-owned role field used by the admin route guard. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("user").addColumn("role", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("user").dropColumn("role").execute();
}
