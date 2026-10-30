/*
 * archive_dataset_versions (new table)
 * ┌──────────────┬─────────────┬──────────────────────────────────────┐
 * │ Column       │ Type        │ Constraints                          │
 * ├──────────────┼─────────────┼──────────────────────────────────────┤
 * │ dataset      │ text        │ PRIMARY KEY; shows, djs, or tags     │
 * │ version      │ integer     │ NOT NULL; greater than 0             │
 * │ updated_at   │ timestamptz │ NOT NULL                             │
 * │ content_hash │ text        │ NOT NULL; 64 lowercase hex characters│
 * └──────────────┴─────────────┴──────────────────────────────────────┘
 *
 * archive_publication_jobs (added column)
 * ┌──────────────────┬───────┬──────────────────────────────────────┐
 * │ Column           │ Type  │ Purpose                              │
 * ├──────────────────┼───────┼──────────────────────────────────────┤
 * │ dataset_versions │ jsonb │ Nullable snapshot of export versions │
 * └──────────────────┴───────┴──────────────────────────────────────┘
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("archive_dataset_versions")
		.addColumn("dataset", "text", (c) =>
			c.primaryKey().check(sql`dataset IN ('shows', 'djs', 'tags')`),
		)
		.addColumn("version", "integer", (c) => c.notNull().check(sql`version > 0`))
		.addColumn("updated_at", "timestamptz", (c) => c.notNull())
		.addColumn("content_hash", "text", (c) =>
			c.notNull().check(sql`content_hash ~ '^[0-9a-f]{64}$'`),
		)
		.execute();
	await db.schema
		.alterTable("archive_publication_jobs")
		.addColumn("dataset_versions", "jsonb")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("archive_publication_jobs")
		.dropColumn("dataset_versions")
		.execute();
	await db.schema.dropTable("archive_dataset_versions").execute();
}
