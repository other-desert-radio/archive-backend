import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Removes the transitional raw DJ image bytes and filename metadata. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.dropColumn("image_filename")
		.dropColumn("image")
		.execute();
}

/** Restores a usable large WebP source for a migration rollback. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.addColumn("image", "bytea")
		.addColumn("image_filename", "text")
		.execute();
	await sql`
		UPDATE djs
		SET
			image = image_large,
			image_filename = CASE
				WHEN image_large IS NULL THEN NULL
				ELSE 'restored-large.webp'
			END
	`.execute(db);
}
