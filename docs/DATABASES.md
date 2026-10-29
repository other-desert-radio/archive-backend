# Database Structure

Read this when changing archive tables, relationships, migrations, or typed
database wiring. Read only the linked workflow guidance relevant to the task:

- [Mixcloud tracking and imports](MIXCLOUD_IMPORT.md): source metadata, refresh
  persistence, import state, deletion, and import transactions.
- [Mixcloud parser](MIXCLOUD_PARSER.md): matchers, DJ names, date suggestions,
  and read-only diagnostics.
- [Static archive export](ARCHIVE_EXPORT.md): JSON contracts and image assets.
- [Development commands](DEVELOPMENT.md#local-dummy-data): seed and delete
  scripts.
- [Database testing](DATABASE_E2E_TESTING.md): disposable PostgreSQL setup.
- [Human design notes](../human_docs/databases_human.md): intent and plans.

## Sources of truth and migration conventions

Confirm current schema in `src/db/migrations/` and application types in
`src/db/types.ts`. PostgreSQL is the source of truth; exported ID arrays are
frontend representations, not primary entity storage.

Follow dependency order and the selected
[development mode](DEVELOPMENT.md#development-modes) for implementation review
gates. Add migrations rather than editing already-applied migrations. Apply
reviewed migrations explicitly, one step at a time; API startup checks
connectivity and does not run migrations. Commands are in the
[development guide](DEVELOPMENT.md#local-environment-and-startup).

Archive tables use `createdAt timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`.
Existing rows received the migration time when this column was introduced.
Authentication tables manage their own creation timestamps.

Migration `0038_add_show_description` adds nullable `shows.description` text for
Mixcloud descriptions. Existing rows start with `NULL`; rollback drops the
column and any stored descriptions.

Relationship foreign keys use `ON DELETE CASCADE`. Deleting a DJ, show, or tag
removes dependent association rows. Mixcloud tracking uses `ON DELETE SET NULL`
and a trigger to retain source rows and clear their import timestamps; see the
[tracking deletion contract](MIXCLOUD_IMPORT.md#consistency-and-deletion).

## Archive dataset versions

Migration `0040_add_archive_dataset_versions` adds `archive_dataset_versions`,
keyed by dataset (`shows`, `djs`, or `tags`). Each row stores an integer
`version`, `updated_at timestamptz`, and a SHA-256 `content_hash`. Rows are
created on first allocation at version 1. Changed exported content advances only
that dataset; unchanged content preserves its version and timestamp. DJ content
includes briefs, details, and image bytes. Shows include their embedded DJ data.

The allocator serializes exporters with a session advisory lock acquired before
opening a repeatable-read transaction. Callers must load database documents
through that transaction for a consistent snapshot. The migration also adds
nullable `archive_publication_jobs.dataset_versions` JSONB, recording the
manifest-shaped version snapshot atomically with allocation. Dataset rows
survive publication-job cleanup. Allocation does not acknowledge publication;
failed filesystem writes can leave allocated versions behind. Publication
execution records its captured revision and dataset snapshot in that allocation
transaction. Remote commit recovery copies the previous job's snapshot without
allocating new versions; legacy jobs retain a null snapshot.

Apply the migration explicitly; startup does not migrate. Rollback drops the
dataset state and job snapshots, losing version history. Tests use
`ARCHIVE_VERSIONS_TEST_DATABASE_URL` with isolated schemas in disposable
PostgreSQL and skip database scenarios when it is unset.

## Mixcloud OAuth connections

Migration `0034_add_mixcloud_connections` adds `mixcloud_connections`, keyed by
`user_id` with cascading archive-user deletion. It stores `mixcloud_key`,
`display_name`, `access_token_encrypted`, `createdAt`, and `updated_at`.
Different archive users may connect the same Mixcloud account. The encrypted
token column holds a versioned AES-256-GCM envelope containing the random
12-byte nonce, 16-byte authentication tag, and ciphertext. Node's built-in
crypto implementation binds the envelope to the archive user via authenticated
data. The stable 32-byte environment key is never stored in PostgreSQL. The
storage layer preserves `createdAt` and updates `updated_at` when replacing a
connection.

`mixcloud_oauth_attempts` stores a SHA-256 hex `state_hash` primary key,
`user_id`, `session_id`, `createdAt`, and `expires_at`. A composite foreign key
to the session's ID and owner prevents cross-user session binding. Deleting a
session cascades pending attempts but preserves its user's Mixcloud connection;
deleting the user cascades both. An added unique session index supports that
composite reference. Attempt expiry must be after creation and at most ten
minutes later. Storage generates 32 random bytes of state, removes expired
attempts for the initiating user when creating a new attempt, and rejects
expired attempts and sessions when completing authorization. Raw state and
authorization codes are not stored.

`createMixcloudStore` exposes identity lookup, server-only token retrieval,
attempt creation, authorization completion, and disconnect. Completion and
disconnect serialize using a transaction-held lock on the archive user. The
completion callback performs token exchange and identity lookup while that lock
is held; it must use bounded provider requests and must not recursively call the
store. Attempts are deleted atomically. Provider rejection commits the deletion
before propagating the error, preserving the previous connection. Concurrent
replays cannot perform a second exchange. Disconnect waits for in-flight
completion, then deletes both the connection and pending attempts. Session
validity is checked again before saving. Unexpected database failures roll back
the transaction, including attempt deletion; they must not be treated as
success.

Apply explicitly after review; startup never migrates. Rollback removes both
Mixcloud tables and their supporting session index, losing connections and
pending attempts while preserving archive users and sessions. Migration tests
use `MIXCLOUD_OAUTH_MIGRATION_TEST_DATABASE_URL` with a disposable database.
Storage tests use `MIXCLOUD_OAUTH_STORE_TEST_DATABASE_URL` with isolated schemas
in a disposable database. No storage functions are wired to routes yet.

## Archive publication revisions

Migration `0029_add_archive_publication_state` creates the singleton
`archive_publication_state` row (`id = 1`). Its bigint `revision` starts at 1
and `published_revision` at 0, so an existing archive starts pending. Migration
`0033_add_publication_modes` adds nullable `published_target` JSONB. Pending
means the revision advanced or the current target differs from the acknowledged
target; an unknown target remains pending. PostgreSQL bigint values remain
decimal strings in application types and JSON to avoid numeric precision loss.

Statement-level triggers on `djs`, `shows`, `tags`, `show_djs`, `show_tags`, and
`dj_tags` increment the revision for each INSERT, UPDATE, DELETE, or TRUNCATE
statement. After migration `0035`, the tag trigger runs before the statement to
acquire the publication lock before tag uniqueness locks; the other five
triggers run after their statements. Revision changes remain transactional in
both cases. This conservatively includes no-op updates and statements affecting
zero rows; revisions are change signals, not row counts or export diffs.
Cascading relationship writes may advance it further. Authentication and
Mixcloud tracking writes do not directly advance archive revisions.

Each trigger emits `archive_publication_changed` with the decimal revision as
its payload. The revision update and notification belong to the writing
transaction: rollback preserves the prior revision and emits no notification;
listeners receive notifications only after commit. Concurrent archive writers
serialize on the singleton row. Notifications are hints to re-read durable
state. Rollback of the migration removes its triggers, function, and state table
while preserving archive records. API startup does not apply it.

## Durable publication jobs

Migration `0030_add_archive_publication_jobs` creates
`archive_publication_jobs`. Each job stores a UUID, requester ID, creation and
completion timestamps, target repository/checkout/branch, optional retry job ID,
stage, outcome, captured bigint revision, commit ID, and optional error. Targets
are copied into each job so recovery can identify its original destination after
configuration changes. Requester and retry IDs have no foreign keys: deleting an
account or later pruning history must not erase job identity.

New jobs start at `queued`/`running`. Database checks restrict stages and
outcomes, require a completion timestamp for terminal outcomes, and prevent
completion timestamps/errors on running jobs. Successful/no-change outcomes
require a captured revision and no error; pushed success also requires a commit
ID for remote jobs. Migration `0033` adds `mode` (`local` or `remote`,
defaulting existing rows to `remote`) and makes repository/branch nullable for
local metadata. Local success requires no commit ID. Creation order is indexed
by timestamp and ID.

Storage currently supports metadata creation/read, running-job stage updates,
and one-time capture of revision and commit ID. Bigint revisions remain decimal
strings; response timestamps use ISO strings and absent nullable fields are
omitted. Commit recording requires a captured revision and a full hexadecimal
Git object ID. Captured revisions and commits cannot be overwritten, and
completed jobs reject progress updates. Missing/ineligible jobs fail writes
rather than silently reporting success.

The runner completes jobs and acknowledges only their captured revision in the
same transaction, saving the target in `published_target`, then prunes history.
Failure never acknowledges publication; newer archive revisions remain pending.
Metadata writes do not advance archive revisions. Interruption recovery and the
authenticated APIs are wired at startup. Rolling back `0030` drops job history
while preserving archive tables and the singleton revision row; roll back the
dependent log migration first.

Migration `0033` backfills the acknowledged remote target only when retained
successful history matches `published_revision`; otherwise it remains unknown.
The JSON object contains `mode`, `checkoutPath`, and optional local repository
and branch metadata; remote targets require both. SQL checks validate its shape.
Rollback preserves remote history and refuses while local jobs or a local
acknowledged target exist, rather than discarding or relabeling them. Apply and
roll back explicitly; startup never migrates.

### Publication admission and lock ownership

`acquirePublicationLease` pins one database connection with Kysely's connection
callback and takes the PostgreSQL session advisory lock `(1095910216, 1)`
(`ARCH`, publication lock 1). It returns undefined when another session holds
the lock. The callback stays open until `release()` unlocks and returns the
connection to the pool. Repeated release calls await the same cleanup and do not
unlock a later lease. Acquisition rejects transaction handles: job creation and
progress must commit durably while the session lock remains held.

`reservePublicationJob` is the admission entry point for the runner. It acquires
the lease, checks for any durable running job, and only then inserts a queued
job. Contention or an existing running row throws `PublicationBusyError`;
database errors propagate. Rejected reservations release their lease. A
successful reservation returns both job and lease; its caller must release in
`finally` after execution. Use the connection on the lease for publication
database work, and never reuse that handle after release. `createPublicationJob`
remains a low-level insert, not an admission entry point.

The lock spans job execution without a long database transaction. PostgreSQL
releases session locks on disconnect, but the durable running row still blocks a
new reservation until interruption recovery handles it. Retrying requires the
latest failed/interrupted job ID for that target and an unchanged destination;
callers cannot bypass failure recovery by starting a fresh job for the same
target. A different mode/destination can start fresh; explicit retries cannot
cross targets. Tests use independent one-connection pools to verify contention,
durable job visibility, repeated release, and cleanup after rejected
reservations.

### Abandoned-job interruption

Before admitting jobs after startup, the runner acquires a fresh publication
lease and call `interruptAbandonedPublications`. The store tracks active lease
objects; fabricated or released leases cannot perform recovery. Another backend
holding the publication lock prevents acquisition, so startup must defer
recovery while that publisher is active. Call recovery before reserving work,
never against a job executing under the caller's own lease.

Recovery changes all leftover `running` jobs to `interrupted`, records the
completion timestamp, and saves a fixed message explaining that explicit Retry
is required. It preserves their stage, target, captured revision, commit ID,
requester, retry identity, and logs. It neither touches Git nor acknowledges
publication revisions, and it creates no job. Existing terminal jobs remain
unchanged except for normal history retention.

Interruption and pruning to the latest 10 completed jobs share one transaction;
failure rolls both back. Repeating recovery does not rewrite interruption
timestamps. The caller retains and releases the lease normally. Recovery never
automatically retries a publication.

### Publication logs and retention

Migration `0031_add_archive_publication_logs` creates a separate log table:

```text
archive_publication_jobs.id
    |
    +-- archive_publication_logs
          job_id      uuid, foreign key with ON DELETE CASCADE
          sequence    integer >= 0
          created_at  timestamptz, default CURRENT_TIMESTAMP
          message     text
          primary key (job_id, sequence)
```

`appendPublicationLog` sanitizes complete messages before persistence: it strips
terminal controls, normalizes line endings, removes blank lines, redacts
recognized credentials/private-key blocks, and replaces caller-supplied secret
values. Callers must supply deployment secrets and avoid logging sensitive raw
command output; pattern matching cannot identify every arbitrary secret.
Sanitization returns separate text lines, suitable for text rendering rather
than HTML. Errors on the job record are separate from this log sanitizer.

Appending locks the running job row for the transaction, allocates increasing
sequences, inserts lines, and trims overflow atomically. Missing or completed
jobs reject appends. The storage function retains at most 2,000 lines per job.
After overflow it keeps the latest 1,999 lines plus one persistent truncation
notice at sequence 0. Normal lines start at 1, and trimming does not renumber
them. The row lock serializes concurrent appends without acquiring the publisher
advisory lock used for job reservation/execution.

`readPublicationJob` reads metadata and ordered logs in one read-only,
repeatable-read snapshot. It returns `logsTruncated` when sequence 0 exists;
missing jobs return undefined. This durable history lets progress views reload
after closure or reconnection. `pruneCompletedPublicationJobs` retains the
newest 10 completed jobs by completion time, creation time, and ID descending,
while preserving every running job. Deleting old jobs cascades to their logs. It
is a single atomic statement and can participate in the later completion
transaction; completion and interruption invoke it automatically. Rolling back
`0031` removes logs while preserving job metadata.

The focused test in `tests/publication/store.test.ts` requires
`PUBLICATION_STORE_TEST_DATABASE_URL` for disposable PostgreSQL and otherwise
skips. It creates a temporary schema and verifies persistence through another
connection, schema constraints, transaction rollback, and migration
rollback/reapply without changing archive revision state. It also verifies log
sanitization, concurrent append ordering, the exact line bound, overflow, atomic
append failures, retention rollback/cascades, and consistent detail snapshots.
Pure sanitization tests run without a database.

## Authentication tables

Better Auth owns its authentication tables separately from archive entities.
Migration `0007_create_better_auth_tables` creates the `user`, `session`,
`account`, and `verification` tables and their lookup indexes. Migration `0008`
adds the server-owned `user.role` field. Migration `0028` adds required
constrained `admin`/`editor` roles (new accounts default to editor),
`mustChangePassword`, Admin plugin fields, and database rate limits. Existing
accounts remain admins without a forced password change. Emails are normalized
and have a case-insensitive unique index; migration fails on collisions for
explicit operator resolution. Public signup remains disabled. Better Auth owns
password hashing in `account.password` and session lifecycle. Passwords are
never reversibly encrypted. Deleting a user cascades to their accounts/sessions.
These tables are not archive resources.

## Core tables

DJ and Show titles are not unique. Do not introduce duplicate-title rejection
without a deliberate schema/product decision.

### `djs`

```text
id          integer primary key
createdAt   timestamptz not null
title       text not null
bio         text
image_small bytea
image_large bytea
socials     text
showTitle   text
showDescription text
```

`bio` and `socials` may contain limited HTML. Both are sanitized before they are
exposed to the frontend; supported formatting is paragraphs, line breaks,
strong/emphasis text, and basic lists.

`showTitle` and `showDescription` are optional plain-text metadata fields. Blank
values are stored as `NULL` and nullable values are omitted from JSON output.

`image_small` and `image_large` store paired 400 by 400 and 1024 by 1024 WebP
derivatives. The columns are both `NULL` when no image exists, or both populated
by a database constraint. Migration `0015` backfills existing original images
and migration `0016` removes those originals. The current upload contract
accepts JPEG, PNG, and WebP files. The DJ admin UI decodes a selected source,
then lets the admin position, zoom, and rotate a square 1200-by-1200 WebP crop.
Sharp creates the stored 400-by-400 and 1024-by-1024 WebP variants from that
crop before insertion. Rolling back migration `0016` restores the large WebP as
`image` with the filename `restored-large.webp`; the original upload cannot be
recovered.

### `shows`

```text
id          integer primary key
createdAt   timestamptz not null
title       text not null
date        timestamptz
duration    integer       -- seconds
mixcloud_image_large text not null -- Mixcloud image URL
mixcloud_image_small text not null -- Mixcloud image URL
image_small bytea         -- nullable stored WebP
image_large bytea         -- nullable stored WebP
url         text          -- audio source URL
```

`duration` is measured in whole seconds. `date` represents a broadcast calendar
day and is stored explicitly at midnight UTC, so its timestamp remains
unambiguous without a local-time interpretation.

Migration `0023_add_show_image_urls` copies `image` into both new URL columns,
then enforces `NOT NULL`. Existing `NULL` images must be filled before applying
it; otherwise the migration fails and the migrator rolls back the transaction.
Rollback drops only the new columns and preserves `image`. There are no defaults
or URL-format constraints. Migration `0024_drop_show_image` removes the legacy
`image` column; its rollback restores that column from the large URL.

Migration `0036_rename_show_mixcloud_images` renames the two URL columns to
`mixcloud_image_small` and `mixcloud_image_large`, preserving their values and
`NOT NULL` constraints. Show create/edit routes and dummy seeds supply both
URLs. The admin API uses these renamed fields; public JSON retains its existing
image field names and Mixcloud URL values. Deploy migration `0036` and its
matching application together because the previous application uses the old
column names. Rollback renames the URL columns back after migration `0037` has
been rolled back.

Migration `0037_add_show_webp_images` adds nullable `bytea` image columns and
the `shows_webp_image_pair` constraint: both must be NULL or both populated,
like DJs. Existing rows remain NULL; there is no download or backfill. These
columns reserve storage for future 400-by-400 and 1024-by-1024 WebP derivatives.
Show create, edit, and import currently write only Mixcloud URLs and leave image
bytes untouched. The admin Shows table links to authenticated stored-image
endpoints when both variants exist. Upload and binary-image export support are
deferred. Rolling back `0037` drops the binary columns and any stored images
while retaining the Mixcloud URLs.

### `tags`

```text
id          integer primary key
createdAt   timestamptz not null
title       text not null
color       text          -- nullable in PostgreSQL
reviewed    boolean not null default false
mixcloud_key text unique
mixcloud_url text
```

Tags represent genres or other archive labels. Tag title normalization and
conflict handling follow the [API conventions](api-routes.md). Migration `0035`
requires nonblank titles stored without leading or trailing JavaScript
whitespace and enforces uniqueness on `lower(title)`. API creation and editing
trim submitted titles before persistence; a database check rejects untrimmed
direct writes. Apply the migration before running the updated application.
Existing untrimmed, blank, or duplicate titles stop it with the affected IDs;
correct those records deliberately and retry. It never rewrites, merges, or
deletes tags. Tag write statements advance the existing publication revision
before acquiring tag row or uniqueness locks, keeping concurrent imports in the
same lock order. Rollback removes the title check and unique index and restores
the publication trigger to run after each tag write.

Tags created with an automatically generated color are unreviewed; tags created
with an explicit color are marked reviewed. Automatic colors use hue 0–360°,
saturation 84–96%, and lightness 62–77%, persisted as lowercase `#rrggbb`.
Reused tags retain their stored colors and review status; existing records are
not recolored.

`mixcloud_key` and `mixcloud_url` are optional source metadata for the matching
Mixcloud genre, for example `/genres/experimental/` and
`https://www.mixcloud.com/genres/experimental/`. They are omitted from exported
JSON when absent. Migration `0020_add_mixcloud_tag_keys` makes non-null
`mixcloud_key` values unique (exact text comparison); multiple null values
remain allowed. Existing duplicate keys must be resolved before applying it; the
migration does not merge or delete tags.

## Relationship tables

Relationships are many-to-many, so each association is represented by one row.
Do not store comma-separated values or arrays of IDs in these tables.

### `show_djs`

Maps shows to participating DJs. A show may have multiple DJs, and a DJ may
participate in multiple shows.

```text
id          integer primary key
createdAt   timestamptz not null
show_id     integer not null references shows(id)
dj_id       integer not null references djs(id)
```

`UNIQUE (show_id, dj_id)` is required to prevent duplicate associations.

Example:

```text
id | show_id | dj_id
1  | 5       | 2
2  | 5       | 3
```

### `show_tags`

Maps genres or labels to shows.

```text
id          integer primary key
createdAt   timestamptz not null
show_id     integer not null references shows(id)
tag_id      integer not null references tags(id)
```

`UNIQUE (show_id, tag_id)` prevents duplicate associations.

### `dj_tags`

Stores tags manually assigned to DJs. These are additional tags and may be
broader than the tags on any individual show.

```text
id          integer primary key
createdAt   timestamptz not null
dj_id       integer not null references djs(id)
tag_id      integer not null references tags(id)
```

`UNIQUE (dj_id, tag_id)` prevents duplicate associations.

The database does not need a separate row for a derived DJ tag. During export,
combine the manually assigned `dj_tags` with the distinct tags from every show
linked through `show_djs` and `show_tags`.

## Integrity and indexing

Every relationship column must reference its parent table. Each relationship
table has a surrogate primary key, a unique pair of foreign keys, and indexes
supporting both lookup directions. The pair's unique index supports lookups by
its first column; reverse indexes begin with `dj_id` on `show_djs`, `tag_id` on
`show_tags`, and `tag_id` on `dj_tags`.

Choose deletion behavior deliberately when adding new relationships. Preserve
these constraints in migrations and update types and the relevant workflow
document when a data contract changes.

### Persisting Mixcloud parser suggestions

Refresh reuses each cloudcast's parsed result when upserting source metadata.
Successful matches insert or replace `derived_title`, `derived_date`,
`decoded_djs`, `parser_version`, `parser_key`, and `date_source` in the same
transaction. Partial successful results retain their nullable fields.
Parser-only changes do not set `data_changed` or alter approved Shows or import
links. Unmatched or excluded titles clear all five suggestion fields to null and
record the current `parser_version`, distinguishing a failed attempt from a row
that has never been parsed. The same rules apply on insert and update. Apply
migration `0022` before refresh. Direct `persistMixcloudEntry` callers without
precomputed results use the shared parser themselves.

## Mixcloud uploads

Migration `0039_add_mixcloud_uploads` stores successful provider uploads before
archive review. Each row has a unique cloudcast `mixcloud_key`, original title,
nullable description, selected UTC date and DJ ID array, provider title,
requested tag names, nullable JSONB `mixcloud_data` for fetched metadata, and
nullable `show_id` for the eventual archive save. Media bytes are not stored. DJ
IDs are validated before uploading and must be revalidated when saving.

`createdAt` defaults to the insertion time. `created_by` references the archive
user; deleting that user preserves the draft and sets its creator to null.
Deleting a linked Show clears `show_id`. Pending uploads do not advance archive
publication state. Apply the migration explicitly before using the updated
upload route; startup does not migrate. Rollback deletes pending upload records,
without deleting Shows or provider uploads.

Preparation stores validated provider metadata in `mixcloud_data` without
creating a Show. Reviewed Save locks the upload and source tracking row and
atomically saves the Show, relationships, import markers, and upload link.
Provider fields come from that snapshot; our reviewed fields supply title,
description, date, DJs, and optionally tag names. Supplied reviewed tags replace
the archive selection; omitted tags retain the snapshot names. Replays return
the existing Show. The same source row lock serializes this workflow with
ordinary Mixcloud imports. Omitted descriptions in existing edit callers
preserve stored text.

Confirmed uploads with `show_id IS NULL` appear in the shared Shows pending
queue, including records whose metadata preparation failed. Listing and resuming
use existing upload IDs; saving links the Show and removes the item from the
queue. No additional migration is needed.

Durable attempts and uncertain upload recovery are deferred to the
[future recovery plan](plans/future/mixcloud-upload-recovery.md). Migration and
storage tests use `MIXCLOUD_UPLOADS_TEST_DATABASE_URL` with an isolated schema
in a disposable PostgreSQL database.
