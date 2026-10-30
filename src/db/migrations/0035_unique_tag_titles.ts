/*
 * tags (added constraints and changed trigger)
 * ┌──────────────────────┬──────────────────┬──────────────────────────────────────────────────┐
 * │ Column / change      │ Type             │ Constraints / purpose                            │
 * ├──────────────────────┼──────────────────┼──────────────────────────────────────────────────┤
 * │ title                │ check            │ Nonblank; trimmed using JavaScript whitespace    │
 * │ lower(title)         │ unique index     │ Reject existing duplicates; no rewrite or merge  │
 * │ publication revision │ BEFORE statement │ Acquire publication lock before uniqueness locks │
 * └──────────────────────┴──────────────────┴──────────────────────────────────────────────────┘
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

// Match the application trim() contract at the storage boundary.
const trimmedTitle = sql<string>`btrim(title, ${sql.lit(" \t\n\r\f\v\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff")})`;

/** Reject duplicates without changing existing tags or their relationships. */
export async function up(db: Kysely<Database>): Promise<void> {
	await sql`LOCK TABLE tags IN SHARE ROW EXCLUSIVE MODE`.execute(db);
	const invalid = await sql<{
		id: number;
	}>`SELECT id FROM tags WHERE title = '' OR title <> ${trimmedTitle} ORDER BY id`.execute(
		db,
	);
	if (invalid.rows.length > 0) {
		throw new Error(
			`Untrimmed or blank tag titles prevent migration 0035. Correct titles for IDs: ${invalid.rows.map((row) => row.id).join(", ")}, then retry. No tags were changed.`,
		);
	}
	const duplicates = await sql<{
		ids: number[];
	}>`SELECT array_agg(id ORDER BY id) AS ids FROM tags
 GROUP BY lower(title) HAVING count(*) > 1`.execute(db);
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
	await sql`ALTER TABLE tags ADD CONSTRAINT tags_title_trimmed CHECK (title <> '' AND title = ${trimmedTitle})`.execute(
		db,
	);
	await sql`CREATE UNIQUE INDEX tags_normalized_title_unique ON tags (lower(title))`.execute(
		db,
	);
}

export async function down(db: Kysely<Database>): Promise<void> {
	await sql`DROP INDEX tags_normalized_title_unique`.execute(db);
	await sql`ALTER TABLE tags DROP CONSTRAINT tags_title_trimmed`.execute(db);
	await sql`CREATE OR REPLACE TRIGGER archive_publication_revision
        AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON tags
        FOR EACH STATEMENT EXECUTE FUNCTION advance_archive_publication_revision()`.execute(
		db,
	);
}
