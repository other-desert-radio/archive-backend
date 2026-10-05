import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Removes the legacy URL after migration 0023 populated both image variants. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("shows").dropColumn("image").execute();
}

/** Restores the compatibility column from the current large image URL. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("shows").addColumn("image", "text").execute();
	await sql`UPDATE shows SET image = image_large`.execute(db);
}
