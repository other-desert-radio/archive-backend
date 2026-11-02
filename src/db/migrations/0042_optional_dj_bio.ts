/*
 * djs (changed nullability)
 * ┌─────────────────┬──────┬────────────────────────────────────────┐
 * │ Column / change │ Type │ Constraints / purpose                  │
 * ├─────────────────┼──────┼────────────────────────────────────────┤
 * │ bio             │ text │ Nullable; absent biographies use NULL  │
 * └─────────────────┴──────┴────────────────────────────────────────┘
 * Blank biographies become NULL; other text is preserved.
 * Rollback converts NULL to '' before restoring NOT NULL.
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.alterColumn("bio", (column) => column.dropNotNull())
		.execute();
	await db.schema
		.alterTable("djs")
		.alterColumn("bio", (column) => column.dropDefault())
		.execute();
	await sql`UPDATE djs SET bio = NULL WHERE bio ~ '^[[:space:]]*$'`.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db
		.updateTable("djs")
		.set({ bio: "" })
		.where("bio", "is", null)
		.execute();
	await db.schema
		.alterTable("djs")
		.alterColumn("bio", (column) => column.setNotNull())
		.execute();
}
