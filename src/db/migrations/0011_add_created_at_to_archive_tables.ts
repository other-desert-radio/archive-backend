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

/** Adds creation timestamps to all archive-owned tables. */
export async function up(db: Kysely<Database>): Promise<void> {
	for (const table of archiveTables) {
		await db.schema
			.alterTable(table)
			.addColumn("createdAt", "timestamptz", (column) =>
				column.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
			)
			.execute();
	}
}

export async function down(db: Kysely<Database>): Promise<void> {
	for (const table of [...archiveTables].reverse()) {
		await db.schema.alterTable(table).dropColumn("createdAt").execute();
	}
}
