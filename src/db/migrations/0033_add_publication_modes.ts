import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/**
 * Preserve existing jobs as remote; add mode, optional local Git metadata, and
 * the acknowledged target. Permit local success without a publication commit.
 * Schema changes only: never inspect Git or export assets from a migration.
 */
export async function up(_db: Kysely<Database>): Promise<void> {
	throw new Error("Not implemented: add publication modes migration");
}

/** Restore the remote-only schema, rejecting incompatible local history safely. */
export async function down(_db: Kysely<Database>): Promise<void> {
	throw new Error("Not implemented: roll back publication modes migration");
}
