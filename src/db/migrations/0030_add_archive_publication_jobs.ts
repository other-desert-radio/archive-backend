/*
 * archive_publication_jobs (new table)
 * ┌─────────────────┬─────────────┬─────────────────────────────────────┐
 * │ Column / change │ Type        │ Constraints / purpose               │
 * ├─────────────────┼─────────────┼─────────────────────────────────────┤
 * │ id              │ uuid        │ PRIMARY KEY                         │
 * │ requested_by    │ text        │ NOT NULL                            │
 * │ created_at      │ timestamptz │ NOT NULL; DEFAULT CURRENT_TIMESTAMP │
 * │ completed_at    │ timestamptz │ Nullable                            │
 * │ repository      │ text        │ NOT NULL                            │
 * │ checkout_path   │ text        │ NOT NULL                            │
 * │ branch          │ text        │ NOT NULL                            │
 * │ retry_job_id    │ uuid        │ Nullable                            │
 * │ stage           │ text        │ NOT NULL; DEFAULT queued            │
 * │ outcome         │ text        │ NOT NULL; DEFAULT running           │
 * │ revision        │ bigint      │ Nullable                            │
 * │ commit_id       │ text        │ Nullable                            │
 * │ error           │ text        │ Nullable                            │
 * └─────────────────┴─────────────┴─────────────────────────────────────┘
 *
 * archive_publication_jobs (integrity)
 * ┌─────────────────┬───────┬──────────────────────────────────────────────────────┐
 * │ Column / change │ Type  │ Constraints / purpose                                │
 * ├─────────────────┼───────┼──────────────────────────────────────────────────────┤
 * │ completion      │ check │ Running: no completion/error; terminal: completed_at │
 * │ success         │ check │ Revision required; no error; succeeded needs commit  │
 * │ created_at, id  │ index │ Creation order; requester/retry IDs have no FK       │
 * └─────────────────┴───────┴──────────────────────────────────────────────────────┘
 */
import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/** Persist job identity, target, progress, and recovery metadata. Logs follow separately. */
export async function up(db: Kysely<Database>): Promise<void> {
	/*
	 * queued/running --> stage + revision + commit --> terminal outcome
	 *                    target stays with the job   completed_at required
	 */
	await db.schema
		.createTable("archive_publication_jobs")
		.addColumn("id", "uuid", (column) => column.primaryKey())
		.addColumn("requested_by", "text", (column) =>
			column.notNull().check(sql`length(btrim(requested_by)) > 0`),
		)
		.addColumn("created_at", "timestamptz", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("completed_at", "timestamptz")
		.addColumn("repository", "text", (column) =>
			column.notNull().check(sql`length(btrim(repository)) > 0`),
		)
		.addColumn("checkout_path", "text", (column) =>
			column.notNull().check(sql`length(btrim(checkout_path)) > 0`),
		)
		.addColumn("branch", "text", (column) =>
			column.notNull().check(sql`length(btrim(branch)) > 0`),
		)
		.addColumn("retry_job_id", "uuid")
		.addColumn("stage", "text", (column) =>
			column
				.notNull()
				.defaultTo("queued")
				.check(
					sql`stage IN ('queued', 'validating', 'synchronizing', 'exporting', 'committing', 'pushing', 'acknowledging')`,
				),
		)
		.addColumn("outcome", "text", (column) =>
			column
				.notNull()
				.defaultTo("running")
				.check(
					sql`outcome IN ('running', 'succeeded', 'no-change', 'failed', 'interrupted')`,
				),
		)
		.addColumn("revision", "bigint", (column) =>
			column.check(sql`revision >= 1`),
		)
		.addColumn("commit_id", "text")
		.addColumn("error", "text")
		.addCheckConstraint(
			"publication_job_completion",
			sql`(outcome = 'running' AND completed_at IS NULL AND error IS NULL) OR (outcome <> 'running' AND completed_at IS NOT NULL)`,
		)
		.addCheckConstraint(
			"publication_job_success",
			sql`outcome NOT IN ('succeeded', 'no-change') OR (revision IS NOT NULL AND error IS NULL)`,
		)
		.addCheckConstraint(
			"publication_job_pushed_commit",
			sql`outcome <> 'succeeded' OR commit_id IS NOT NULL`,
		)
		.execute();
	await db.schema
		.createIndex("publication_jobs_created_at_idx")
		.on("archive_publication_jobs")
		.columns(["created_at", "id"])
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("archive_publication_jobs").execute();
}
