/*
 * shows (added columns)
 * ┌─────────────────┬───────┬───────────────────────┐
 * │ Column / change │ Type  │ Constraints / purpose │
 * ├─────────────────┼───────┼───────────────────────┤
 * │ image_small     │ bytea │ Nullable              │
 * │ image_large     │ bytea │ Nullable              │
 * └─────────────────┴───────┴───────────────────────┘
 *
 * shows (added constraint)
 * ┌─────────────────┬───────┬──────────────────────────────────────────┐
 * │ Column / change │ Type  │ Constraints / purpose                    │
 * ├─────────────────┼───────┼──────────────────────────────────────────┤
 * │ image pair      │ check │ Both NULL or both populated; no backfill │
 * └─────────────────┴───────┴──────────────────────────────────────────┘
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Reserves paired image storage without backfilling existing shows. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("shows")
		.addColumn("image_small", "bytea")
		.addColumn("image_large", "bytea")
		.execute();
	await sql`ALTER TABLE shows ADD CONSTRAINT shows_webp_image_pair CHECK ((image_small IS NULL) = (image_large IS NULL))`.execute(
		db,
	);
}

/** Drops stored image bytes while retaining the Mixcloud URLs. */
export async function down(db: Kysely<Database>): Promise<void> {
	await sql`ALTER TABLE shows DROP CONSTRAINT shows_webp_image_pair`.execute(
		db,
	);
	await db.schema
		.alterTable("shows")
		.dropColumn("image_large")
		.dropColumn("image_small")
		.execute();
}
