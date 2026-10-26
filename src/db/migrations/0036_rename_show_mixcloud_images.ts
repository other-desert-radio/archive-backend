import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Preserves existing show image URLs under their source-specific names. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.renameColumn("image_small", "mixcloud_image_small")
		.execute();
	await db.schema
		.alterTable("shows")
		.renameColumn("image_large", "mixcloud_image_large")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.renameColumn("mixcloud_image_large", "image_large")
		.execute();
	await db.schema
		.alterTable("shows")
		.renameColumn("mixcloud_image_small", "image_small")
		.execute();
}
