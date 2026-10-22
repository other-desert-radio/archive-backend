import { type Kysely, sql } from "kysely";
import { normalizedTagTitle } from "../normalized-tag-title.js";
import type { Database } from "../types.js";

/** Reject duplicates without changing existing tags or their relationships. */
export async function up(db: Kysely<Database>): Promise<void> {
	await sql`LOCK TABLE tags IN SHARE ROW EXCLUSIVE MODE`.execute(db);
	const duplicates = await sql<{
		ids: number[];
	}>`SELECT array_agg(id ORDER BY id) AS ids FROM tags
 GROUP BY ${normalizedTagTitle} HAVING count(*) > 1`.execute(db);
	if (duplicates.rows.length > 0) {
		throw new Error(
			`Duplicate normalized tag titles prevent migration 0035. Conflicting ID groups: ${JSON.stringify(duplicates.rows.map((group) => group.ids))}. Resolve their titles and relationships deliberately, then retry. No tags were changed.`,
		);
	}
	// Take the existing publication lock before tag uniqueness locks, not after them.
	await sql`CREATE OR REPLACE TRIGGER archive_publication_revision
        BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON tags
        FOR EACH STATEMENT EXECUTE FUNCTION advance_archive_publication_revision()`.execute(
		db,
	);
	await sql`CREATE UNIQUE INDEX tags_normalized_title_unique ON tags (${normalizedTagTitle})`.execute(
		db,
	);
}

export async function down(db: Kysely<Database>): Promise<void> {
	await sql`DROP INDEX tags_normalized_title_unique`.execute(db);
	await sql`CREATE OR REPLACE TRIGGER archive_publication_revision
        AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON tags
        FOR EACH STATEMENT EXECUTE FUNCTION advance_archive_publication_revision()`.execute(
		db,
	);
}
