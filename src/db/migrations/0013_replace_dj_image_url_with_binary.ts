import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Replaces DJ image URLs with raw image bytes and filename metadata. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("djs").dropColumn("image").execute();
	await db.schema
		.alterTable("djs")
		.addColumn("image", "bytea")
		.addColumn("image_filename", "text")
		.execute();
}

/** Restores the previous nullable text image URL column. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.dropColumn("image_filename")
		.dropColumn("image")
		.addColumn("image", "text")
		.execute();
}
