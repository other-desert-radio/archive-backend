import { type Kysely, sql } from "kysely";

/** Job/log changes wake browser streams only after their transaction commits. */
export async function up(database: Kysely<unknown>): Promise<void> {
	await sql`CREATE FUNCTION notify_archive_publication_job_change() RETURNS trigger
 LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_notify('archive_publication_changed', 'job'); RETURN NULL;
 END $$`.execute(database);
	for (const table of [
		"archive_publication_jobs",
		"archive_publication_logs",
	]) {
		await sql`CREATE TRIGGER publication_job_changed AFTER INSERT OR UPDATE OR DELETE
 ON ${sql.table(table)} FOR EACH STATEMENT EXECUTE FUNCTION notify_archive_publication_job_change()`.execute(
			database,
		);
	}
}
export async function down(database: Kysely<unknown>): Promise<void> {
	for (const table of [
		"archive_publication_jobs",
		"archive_publication_logs",
	]) {
		await sql`DROP TRIGGER IF EXISTS publication_job_changed ON ${sql.table(table)}`.execute(
			database,
		);
	}
	await sql`DROP FUNCTION IF EXISTS notify_archive_publication_job_change()`.execute(
		database,
	);
}
