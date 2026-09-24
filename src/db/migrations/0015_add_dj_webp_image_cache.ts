import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Adds cached public WebP derivatives for DJ archive images. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.addColumn("image_1024_webp", "bytea")
		.addColumn("image_400_webp", "bytea")
		.execute();
	await sql`
		ALTER TABLE djs
		ADD CONSTRAINT djs_webp_image_cache_pair
		CHECK ((image_1024_webp IS NULL) = (image_400_webp IS NULL))
	`.execute(db);
}

/** Removes cached public WebP derivatives for DJ archive images. */
export async function down(db: Kysely<Database>): Promise<void> {
	await sql`ALTER TABLE djs DROP CONSTRAINT djs_webp_image_cache_pair`.execute(
		db,
	);
	await db.schema
		.alterTable("djs")
		.dropColumn("image_400_webp")
		.dropColumn("image_1024_webp")
		.execute();
}
