import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Preserve legacy keys in source JSON before removing the duplicate column. */
export async function up(db: Kysely<Database>): Promise<void> {
	await sql`UPDATE mixcloud_import AS source
 SET mixcloud_tags = COALESCE(source.mixcloud_tags, '[]'::jsonb) || COALESCE((
  SELECT jsonb_agg(jsonb_build_object('key', legacy.key, 'name', '') ORDER BY legacy.key)
  FROM (SELECT DISTINCT unnest(source.mixcloud_tag_keys) AS key) AS legacy
  WHERE NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(COALESCE(source.mixcloud_tags, '[]'::jsonb)) AS tag
   WHERE tag->>'key' = legacy.key
  )
 ), '[]'::jsonb)
 WHERE source.mixcloud_tag_keys IS NOT NULL`.execute(db);
	await db.schema
		.alterTable("mixcloud_import")
		.dropColumn("mixcloud_tag_keys")
		.execute();
}

/** Reconstruct the legacy array from JSON, retaining source names and URLs. */
export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("mixcloud_import")
		.addColumn("mixcloud_tag_keys", sql`text[]`)
		.execute();
	await sql`UPDATE mixcloud_import AS source
 SET mixcloud_tag_keys = ARRAY(
  SELECT DISTINCT tag->>'key' FROM jsonb_array_elements(source.mixcloud_tags) AS tag
  ORDER BY tag->>'key'
 ) WHERE source.mixcloud_tags IS NOT NULL`.execute(db);
}
