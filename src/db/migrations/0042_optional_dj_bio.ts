import type { Kysely } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.alterColumn("bio", (column) => column.setDefault(""))
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("djs")
		.alterColumn("bio", (column) => column.dropDefault())
		.execute();
}
