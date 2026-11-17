/*
 * archive_dataset_versions (changed CHECK constraint)
 * ┌─────────┬──────┬──────────────────────────────────────┐
 * │ Column  │ Type │ Allowed values                       │
 * ├─────────┼──────┼──────────────────────────────────────┤
 * │ dataset │ text │ shows, djs, tags, show_details        │
 * └─────────┴──────┴──────────────────────────────────────┘
 * Existing versions and source show data are preserved.
 * Rollback deletes only the show_details version row and restores the constraint.
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("archive_dataset_versions")
		.dropConstraint("archive_dataset_versions_dataset_check")
		.execute();
	await db.schema
		.alterTable("archive_dataset_versions")
		.addCheckConstraint(
			"archive_dataset_versions_dataset_check",
			sql`dataset IN ('shows', 'djs', 'tags', 'show_details')`,
		)
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db
		.deleteFrom("archive_dataset_versions")
		.where("dataset", "=", "show_details")
		.execute();
	await db.schema
		.alterTable("archive_dataset_versions")
		.dropConstraint("archive_dataset_versions_dataset_check")
		.execute();
	await db.schema
		.alterTable("archive_dataset_versions")
		.addCheckConstraint(
			"archive_dataset_versions_dataset_check",
			sql`dataset IN ('shows', 'djs', 'tags')`,
		)
		.execute();
}
