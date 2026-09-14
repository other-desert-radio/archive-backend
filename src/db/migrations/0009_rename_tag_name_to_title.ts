import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Renames the tag label column to match the archive's title field contract. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("tags").renameColumn("name", "title").execute();
	await db.schema
		.alterTable("tags")
		.alterColumn("color", (column) => column.setNotNull())
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("tags").renameColumn("title", "name").execute();
	await db.schema
		.alterTable("tags")
		.alterColumn("color", (column) => column.dropNotNull())
		.execute();
}
