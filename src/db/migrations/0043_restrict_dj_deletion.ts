/*
 * show_djs (changed foreign key)
 * ┌─────────────────┬─────────┬───────────────────────────────────────────┐
 * │ Column / change │ Type    │ Constraints / purpose                     │
 * ├─────────────────┼─────────┼───────────────────────────────────────────┤
 * │ dj_id           │ integer │ REFERENCES djs(id) ON DELETE RESTRICT     │
 * └─────────────────┴─────────┴───────────────────────────────────────────┘
 * Existing DJs, Shows, and associations are preserved.
 * Rollback restores cascading DJ deletion without changing existing rows.
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await sql`ALTER TABLE show_djs
		DROP CONSTRAINT show_djs_dj_id_fkey,
		ADD CONSTRAINT show_djs_dj_id_fkey FOREIGN KEY (dj_id)
			REFERENCES djs(id) ON DELETE RESTRICT`.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
	await sql`ALTER TABLE show_djs
		DROP CONSTRAINT show_djs_dj_id_fkey,
		ADD CONSTRAINT show_djs_dj_id_fkey FOREIGN KEY (dj_id)
			REFERENCES djs(id) ON DELETE CASCADE`.execute(db);
}
