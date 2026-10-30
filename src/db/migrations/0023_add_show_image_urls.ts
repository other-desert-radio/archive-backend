/*
 * shows (added columns)
 * ┌─────────────────┬──────┬───────────────────────┐
 * │ Column / change │ Type │ Constraints / purpose │
 * ├─────────────────┼──────┼───────────────────────┤
 * │ image_large     │ text │ Nullable              │
 * │ image_small     │ text │ Nullable              │
 * └─────────────────┴──────┴───────────────────────┘
 *
 * shows (backfill)
 * ┌───────────────────────────┬──────┬─────────────────────────────────────────────┐
 * │ Column / change           │ Type │ Constraints / purpose                       │
 * ├───────────────────────────┼──────┼─────────────────────────────────────────────┤
 * │ image_large / image_small │ text │ Copy image into both; then require NOT NULL │
 * └───────────────────────────┴──────┴─────────────────────────────────────────────┘
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Copies existing image URLs before requiring both image variants. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.addColumn("image_large", "text")
		.addColumn("image_small", "text")
		.execute();

	await sql`UPDATE shows SET image_large = image, image_small = image`.execute(
		db,
	);

	await db.schema
		.alterTable("shows")
		.alterColumn("image_large", (column) => column.setNotNull())
		.alterColumn("image_small", (column) => column.setNotNull())
		.execute();
}

/** Removes the variants while preserving the original image column. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.dropColumn("image_small")
		.dropColumn("image_large")
		.execute();
}
