import { type Kysely, sql } from "kysely";
import type { Database } from "../types.js";

/**
 * Preserve existing jobs as remote; add mode, optional local Git metadata, and
 * the acknowledged target. Permit local success without a publication commit.
 * Schema changes only: never inspect Git or export assets from a migration.
 */
export async function up(db: Kysely<Database>): Promise<void> {
	await sql`ALTER TABLE archive_publication_jobs
		ADD COLUMN mode text NOT NULL DEFAULT 'remote'
			CHECK (mode IN ('local', 'remote')),
		ALTER COLUMN repository DROP NOT NULL,
		ALTER COLUMN branch DROP NOT NULL,
		DROP CONSTRAINT publication_job_pushed_commit,
		ADD CONSTRAINT publication_job_remote_target
			CHECK (mode = 'local' OR (repository IS NOT NULL AND branch IS NOT NULL)),
		ADD CONSTRAINT publication_job_pushed_commit
			CHECK (mode = 'local' OR outcome <> 'succeeded' OR commit_id IS NOT NULL)
	`.execute(db);
	await sql`ALTER TABLE archive_publication_state
		ADD COLUMN published_target jsonb,
		ADD CONSTRAINT publication_published_target CHECK (
			published_target IS NULL OR COALESCE(
				jsonb_typeof(published_target) = 'object'
				AND published_target->>'mode' IN ('local', 'remote')
				AND jsonb_typeof(published_target->'checkoutPath') = 'string'
				AND length(btrim(published_target->>'checkoutPath')) > 0
				AND (NOT published_target ? 'repository' OR (
					jsonb_typeof(published_target->'repository') = 'string'
					AND length(btrim(published_target->>'repository')) > 0
				))
				AND (NOT published_target ? 'branch' OR (
					jsonb_typeof(published_target->'branch') = 'string'
					AND length(btrim(published_target->>'branch')) > 0
				))
				AND (published_target->>'mode' = 'local' OR (
					published_target ? 'repository' AND published_target ? 'branch'
				)), false
			)
		)
	`.execute(db);
	// Preserve the acknowledged destination only when retained success proves it.
	// With no matching history, leave it unknown rather than inventing a target.
	await sql`UPDATE archive_publication_state AS state SET published_target = (
		SELECT jsonb_build_object('mode', 'remote', 'checkoutPath', checkout_path,
			'repository', repository, 'branch', branch)
		FROM archive_publication_jobs
		WHERE revision = state.published_revision
			AND outcome IN ('succeeded', 'no-change')
		ORDER BY completed_at DESC, created_at DESC, id DESC LIMIT 1
	)`.execute(db);
}

/** Restore the remote-only schema, rejecting incompatible local history safely. */
export async function down(db: Kysely<Database>): Promise<void> {
	// Fail before any DDL: the old schema cannot represent local job history.
	const local = await db
		.selectFrom("archive_publication_jobs")
		.select("id")
		.where("mode", "=", "local")
		.limit(1)
		.executeTakeFirst();
	if (local !== undefined)
		throw new Error(
			"Cannot roll back publication modes while local publication jobs exist",
		);
	const localAcknowledgement = await db
		.selectFrom("archive_publication_state")
		.select("id")
		.where(sql<string>`published_target->>'mode'`, "=", "local")
		.limit(1)
		.executeTakeFirst();
	if (localAcknowledgement !== undefined)
		throw new Error(
			"Cannot roll back publication modes while the acknowledged target is local",
		);
	await sql`ALTER TABLE archive_publication_jobs
		DROP CONSTRAINT publication_job_remote_target,
		DROP CONSTRAINT publication_job_pushed_commit,
		ALTER COLUMN repository SET NOT NULL,
		ALTER COLUMN branch SET NOT NULL,
		ADD CONSTRAINT publication_job_pushed_commit
			CHECK (outcome <> 'succeeded' OR commit_id IS NOT NULL),
		DROP COLUMN mode
	`.execute(db);
	await sql`ALTER TABLE archive_publication_state
		DROP CONSTRAINT publication_published_target,
		DROP COLUMN published_target
	`.execute(db);
}
