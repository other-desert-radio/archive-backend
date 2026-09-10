import type { Kysely } from "kysely";
import type { Database } from "../db.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("djs")
		.addColumn("id", "integer", (column) =>
			column.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("title", "text", (column) => column.notNull())
		.addColumn("bio", "text", (column) => column.notNull())
		.addColumn("image", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("djs").execute();
}
