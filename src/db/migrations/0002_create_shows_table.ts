import type { Kysely } from "kysely";
import type { Database } from "../types.js";

/*
 * Shows Database:
 *
 * +----------+-------------+-------------+
 * | column   | type        | constraints |
 * +----------+-------------+-------------+
 * | id       | integer     | primary key |
 * | title    | text        | not null    |
 * | date     | timestamptz | not null    |
 * | duration | integer     | not null    |
 * | image    | text        | nullable    |
 * | url      | text        | nullable    |
 * +----------+-------------+-------------+
 */
export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("shows")
		.addColumn("id", "integer", (column) =>
			column.generatedByDefaultAsIdentity().primaryKey(),
		)
		.addColumn("title", "text", (c) => c.notNull())
		.addColumn("date", "timestamptz", (c) => c.notNull())
		.addColumn("duration", "integer", (c) => c.notNull())
		.addColumn("image", "text")
		.addColumn("url", "text")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("shows").execute();
}
