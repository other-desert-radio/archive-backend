/*
 * shows (removed columns and constraint)
 * ┌───────────────────────┬───────┬───────────────────────────────────┐
 * │ Column / change       │ Type  │ Constraints / purpose             │
 * ├───────────────────────┼───────┼───────────────────────────────────┤
 * │ image_small           │ bytea │ Remove unused nullable image      │
 * │ image_large           │ bytea │ Remove unused nullable image      │
 * │ shows_webp_image_pair │ check │ Remove paired-image constraint    │
 * └───────────────────────┴───────┴───────────────────────────────────┘
 * Preserves Shows and Mixcloud image URLs. Any stored image bytes are lost.
 * Rollback restores nullable columns and their pair constraint, with NULL data.
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.dropConstraint("shows_webp_image_pair")
		.execute();
	await db.schema
		.alterTable("shows")
		.dropColumn("image_small")
		.dropColumn("image_large")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.addColumn("image_small", "bytea")
		.addColumn("image_large", "bytea")
		.execute();
	await db.schema
		.alterTable("shows")
		.addCheckConstraint(
			"shows_webp_image_pair",
			sql`(image_small IS NULL) = (image_large IS NULL)`,
		)
		.execute();
}
