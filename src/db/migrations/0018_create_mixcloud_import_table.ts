import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Tracks Mixcloud imports while retaining source keys after show deletion. */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("mixcloud_import")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("createdAt", "timestamptz", (c) =>
			c.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("key", "text", (c) => c.notNull().unique())
		.addColumn("show_id", "integer", (c) =>
			c.references("shows.id").onDelete("set null"),
		)
		.addColumn("imported_at", "timestamptz")
		.addCheckConstraint(
			"mixcloud_import_import_state_check",
			sql`(show_id IS NULL) = (imported_at IS NULL)`,
		)
		.execute();

	await db.schema
		.createIndex("mixcloud_import_show_id_idx")
		.on("mixcloud_import")
		.column("show_id")
		.execute();

	await sql`
		CREATE FUNCTION mixcloud_import_clear_imported_at()
		RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN
			IF NEW.show_id IS NULL THEN
				NEW.imported_at := NULL;
			END IF;
			RETURN NEW;
		END;
		$$
	`.execute(db);

	await sql`
		CREATE TRIGGER mixcloud_import_clear_imported_at_trigger
		BEFORE UPDATE OF show_id ON mixcloud_import
		FOR EACH ROW EXECUTE FUNCTION mixcloud_import_clear_imported_at()
	`.execute(db);
}

/** Removes import bookkeeping without deleting any shows. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("mixcloud_import").execute();
	await sql`DROP FUNCTION mixcloud_import_clear_imported_at()`.execute(db);
}
