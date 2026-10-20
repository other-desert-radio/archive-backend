import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

const archiveTables = [
	"djs",
	"shows",
	"tags",
	"show_djs",
	"show_tags",
	"dj_tags",
] as const;

/** Start pending, and track archive write statements in their own transaction. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("archive_publication_state")
		.addColumn("id", "integer", (column) =>
			column.primaryKey().defaultTo(1).check(sql`id = 1`),
		)
		.addColumn("revision", "bigint", (column) =>
			column.notNull().defaultTo(1).check(sql`revision >= 1`),
		)
		.addColumn("published_revision", "bigint", (column) =>
			column
				.notNull()
				.defaultTo(0)
				.check(sql`published_revision >= 0 AND published_revision <= revision`),
		)
		.execute();
	await db.insertInto("archive_publication_state").defaultValues().execute();
	await sql`CREATE FUNCTION advance_archive_publication_revision()
		RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
		DECLARE next_revision bigint;
		BEGIN
			UPDATE archive_publication_state SET revision = revision + 1
			WHERE id = 1 RETURNING revision INTO STRICT next_revision;
			PERFORM pg_notify('archive_publication_changed', next_revision::text);
			RETURN NULL;
		END;
		$$`.execute(db);
	for (const table of archiveTables) {
		await sql`CREATE TRIGGER archive_publication_revision
			AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${sql.id(table)}
			FOR EACH STATEMENT EXECUTE FUNCTION advance_archive_publication_revision()`.execute(
			db,
		);
	}
}

export async function down(db: Kysely<Database>): Promise<void> {
	for (const table of archiveTables) {
		await sql`DROP TRIGGER archive_publication_revision ON ${sql.id(table)}`.execute(
			db,
		);
	}
	await sql`DROP FUNCTION advance_archive_publication_revision()`.execute(db);
	await db.schema.dropTable("archive_publication_state").execute();
}
