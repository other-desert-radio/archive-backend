import { sql } from "kysely";

export const decodedDjsExist = sql<boolean>`NOT EXISTS (
 SELECT 1 FROM unnest(mixcloud_import.decoded_djs) AS parsed(name)
 WHERE NOT EXISTS (
  SELECT 1 FROM djs WHERE lower(trim(djs.title)) = lower(trim(parsed.name))
 )
)`.as("decoded_djs_exist");
export const missingDjs = sql<string[]>`ARRAY(
 SELECT trim(parsed.name)
 FROM unnest(mixcloud_import.decoded_djs) WITH ORDINALITY AS parsed(name, position)
 WHERE trim(parsed.name) <> ''
 AND NOT EXISTS (
  SELECT 1 FROM djs WHERE lower(trim(djs.title)) = lower(trim(parsed.name))
 )
 ORDER BY parsed.position
)`.as("missing_djs");
