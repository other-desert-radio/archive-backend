import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/*
 * Tags Database:
 *
 * +-------+---------+------------+
 * | column | type    | constraints |
 * +-------+---------+------------+
 * | id    | integer | primary key |
 * | name  | text    | not null   |
 * | color | text    | nullable   |
 * +-------+---------+------------+
 */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("tags")
		.addColumn("id", "integer", (c) =>
			c.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("name", "text", (c) => c.notNull())
		.addColumn("color", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("tags").execute();
}
