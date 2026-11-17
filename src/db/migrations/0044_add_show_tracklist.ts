/*
 * shows (added column)
 * ┌───────────┬───────┬───────────────────────────────────────────────┐
 * │ Column    │ Type  │ Constraints / purpose                         │
 * ├───────────┼───────┼───────────────────────────────────────────────┤
 * │ tracklist │ jsonb │ NOT NULL; DEFAULT []; validated ordered array │
 * └───────────┴───────┴───────────────────────────────────────────────┘
 * Entries contain either nonblank artist/song strings or a nonblank chapter,
 * and start_time (JSON null or nonnegative whole seconds). Existing rows get [].
 * Adds immutable shows_tracklist_valid(jsonb) for the CHECK constraint.
 * Rollback drops the column and validator, losing stored tracklists.
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await sql`
		CREATE FUNCTION shows_tracklist_valid(value jsonb)
		RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
			SELECT CASE WHEN jsonb_typeof(value) = 'array' THEN
				NOT EXISTS (
					SELECT 1 FROM jsonb_array_elements(value) AS entries(entry)
					WHERE (
						jsonb_typeof(entry) = 'object'
						AND (
							-- ~ searches for a regex match; [^[:space:]] matches any non-whitespace
							-- character, rejecting empty/whitespace-only artist and song strings.
							(jsonb_typeof(entry->'artist') = 'string'
							 AND entry->>'artist' ~ '[^[:space:]]'
							 AND jsonb_typeof(entry->'song') = 'string'
							 AND entry->>'song' ~ '[^[:space:]]'
							 AND NOT entry ? 'chapter')
							-- Apply the same nonblank check to chapter names.
							OR (jsonb_typeof(entry->'chapter') = 'string'
							 AND entry->>'chapter' ~ '[^[:space:]]'
							 AND NOT entry ? 'artist' AND NOT entry ? 'song')
						)
						AND CASE jsonb_typeof(entry->'start_time')
							WHEN 'null' THEN true
							WHEN 'number' THEN
								(entry->>'start_time')::numeric >= 0
								AND trunc((entry->>'start_time')::numeric)
									= (entry->>'start_time')::numeric
							ELSE false
						END
					) IS NOT TRUE
				) ELSE false END
		$$
	`.execute(db);
	await db.schema
		.alterTable("shows")
		.addColumn("tracklist", "jsonb", (column) =>
			column.notNull().defaultTo(sql`'[]'::jsonb`),
		)
		.execute();
	await db.schema
		.alterTable("shows")
		.addCheckConstraint(
			"shows_tracklist_shape",
			sql`shows_tracklist_valid(tracklist)`,
		)
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("shows").dropColumn("tracklist").execute();
	await sql`DROP FUNCTION shows_tracklist_valid(jsonb)`.execute(db);
}
