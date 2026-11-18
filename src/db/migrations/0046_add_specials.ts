/*
 * specials (new table), shows (added relationship), dataset versions
 * ┌───────────────────┬─────────────┬──────────────────────────────────────────┐
 * │ Column / change   │ Type        │ Constraints / purpose                    │
 * ├───────────────────┼─────────────┼──────────────────────────────────────────┤
 * │ specials.id       │ serial      │ PRIMARY KEY                              │
 * │ specials.createdAt│ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP      │
 * │ specials.title    │ text        │ NOT NULL; nonblank                       │
 * │ shows.special_id  │ integer     │ NULL; FK specials(id), DELETE RESTRICT   │
 * │ dataset           │ text        │ Also permits specials                    │
 * │ specials writes   │ trigger     │ Advance archive publication revision     │
 * └───────────────────┴─────────────┴──────────────────────────────────────────┘
 * Existing Shows and DJ links are preserved with no Special assignment.
 * Rollback loses Specials, assignments, and Specials dataset version history.
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("specials")
		.addColumn("id", "serial", (c) => c.primaryKey())
		.addColumn("createdAt", "timestamptz", (c) =>
			c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("title", "text", (c) =>
			c.notNull().check(sql`title ~ '[^[:space:]]'`),
		)
		.execute();
	await db.schema
		.alterTable("shows")
		.addColumn("special_id", "integer", (c) =>
			c.references("specials.id").onDelete("restrict"),
		)
		.execute();
	await db.schema
		.createIndex("shows_special_id_index")
		.on("shows")
		.column("special_id")
		.execute();
	await db.schema
		.alterTable("archive_dataset_versions")
		.dropConstraint("archive_dataset_versions_dataset_check")
		.execute();
	await db.schema
		.alterTable("archive_dataset_versions")
		.addCheckConstraint(
			"archive_dataset_versions_dataset_check",
			sql`dataset IN ('shows', 'djs', 'tags', 'show_details', 'specials')`,
		)
		.execute();
	await sql`CREATE TRIGGER archive_publication_revision
		AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON specials
		FOR EACH STATEMENT EXECUTE FUNCTION advance_archive_publication_revision()`.execute(
		db,
	);
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("shows").dropColumn("special_id").execute();
	await db.schema.dropTable("specials").execute();
	await db
		.deleteFrom("archive_dataset_versions")
		.where("dataset", "=", "specials")
		.execute();
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
