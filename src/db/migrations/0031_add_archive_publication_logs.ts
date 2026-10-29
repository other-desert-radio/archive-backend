/*
 * archive_publication_logs (new table)
 * ┌─────────────────┬─────────────┬────────────────────────────────────────────────────────────┐
 * │ Column / change │ Type        │ Constraints / purpose                                      │
 * ├─────────────────┼─────────────┼────────────────────────────────────────────────────────────┤
 * │ job_id          │ uuid        │ NOT NULL; FK archive_publication_jobs.id ON DELETE CASCADE │
 * │ sequence        │ integer     │ NOT NULL                                                   │
 * │ created_at      │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP                        │
 * │ message         │ text        │ NOT NULL                                                   │
 * └─────────────────┴─────────────┴────────────────────────────────────────────────────────────┘
 *
 * archive_publication_logs (integrity)
 * ┌──────────────────┬─────────────┬────────────────────────────────────────┐
 * │ Column / change  │ Type        │ Constraints / purpose                  │
 * ├──────────────────┼─────────────┼────────────────────────────────────────┤
 * │ job_id, sequence │ primary key │ Unique sequence per job; sequence >= 0 │
 * └──────────────────┴─────────────┴────────────────────────────────────────┘
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

export async function up(db: Kysely<Database>): Promise<void> {
	/* job -- ON DELETE CASCADE --> logs (sequence 0 = truncation notice) */
	await db.schema
		.createTable("archive_publication_logs")
		.addColumn("job_id", "uuid", (column) =>
			column
				.notNull()
				.references("archive_publication_jobs.id")
				.onDelete("cascade"),
		)
		.addColumn("sequence", "integer", (column) =>
			column.notNull().check(sql`sequence >= 0`),
		)
		.addColumn("created_at", "timestamptz", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("message", "text", (column) => column.notNull())
		.addPrimaryKeyConstraint("publication_logs_job_sequence_pk", [
			"job_id",
			"sequence",
		])
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("archive_publication_logs").execute();
}
