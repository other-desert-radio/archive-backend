import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/** Retains optional cloudcast metadata alongside import tracking. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.addColumn("url", "text")
		.addColumn("name", "text")
		.addColumn("created_time", "timestamptz")
		.addColumn("duration", "integer")
		.addColumn("image_small", "text")
		.addColumn("image_large", "text")
		.execute();
}

/** Removes source metadata while preserving import tracking. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.dropColumn("image_large")
		.dropColumn("image_small")
		.dropColumn("duration")
		.dropColumn("created_time")
		.dropColumn("name")
		.dropColumn("url")
		.execute();
}
