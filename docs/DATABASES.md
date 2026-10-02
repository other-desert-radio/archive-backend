# Database Structure

This document is the implementation reference for agents building or changing
the archive database. The human-readable design notes are in
[`human_docs/databases_human.md`](../human_docs/databases_human.md).

## Build and migration decisions

The schema will be built incrementally, with one table per migration. The tables
will be created in dependency order: `djs`, `shows`, `tags`, `show_djs`,
`show_tags`, then `dj_tags`. Work pauses after each table so the schema can be
reviewed before the next migration is added or applied.

Migrations will be run explicitly, one step at a time, rather than automatically
when the API starts. API startup will continue to check only PostgreSQL
connectivity.

Archive tables use a `createdAt timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`
column. Migration `0011_add_created_at_to_archive_tables` adds it to `djs`,
`shows`, `tags`, `show_djs`, `show_tags`, and `dj_tags`. Existing rows receive
the migration time; new rows receive their insertion time from PostgreSQL.
Migration `0013_replace_dj_image_url_with_binary` replaces the nullable DJ image
URL with nullable raw image bytes and filename metadata. Existing DJ image URL
values are intentionally discarded because they are not used by the current
dataset. Migration `0015_add_dj_webp_images` adds nullable `image_small` and
`image_large` WebP columns, backfills them from every stored original image with
the shared Sharp processor, and requires them to be a complete pair. Migration
`0016_drop_dj_original_images` removes the transitional original image columns.
Better Auth tables have their own independently managed `createdAt` columns.

The many-to-many relationship foreign keys use `ON DELETE CASCADE`. Deleting a
DJ, show, or tag therefore removes its dependent relationship rows
automatically. The planned `mixcloud_import.show_id` foreign key is an
exception: it uses `ON DELETE SET NULL` so the source tracking row survives a
hard-deleted show.

The current effort is limited to the PostgreSQL schema, migrations, and typed
database wiring. The JSON exporter and its sanitization logic are out of scope
until the schema has been built and reviewed.

## Purpose

The backend stores archive data in PostgreSQL. `bun run db:export:archive`
writes the following assets to the configured Astro frontend directories:

- `src/res/djs_brief.json`, the compact DJ index;
- `src/res/djs/{id}.json`, one detail document per DJ;
- `src/res/shows.json`, the top-level show index;
- `src/res/tags.json`, the shared tag dictionary; and
- `public/assets/djs/{id}_small.webp` and `{id}_large.webp`, copied DJ image
  assets.

Astro imports JSON from `src/res/` as part of the site build and copies
`public/assets/` into the deployed site unchanged. The database remains the
source of truth. Arrays of IDs belong in exported documents, not in the primary
entity tables.

## Local dummy data

`bun run db:seed:djs` inserts five standalone DJ records for local development.
The fixtures intentionally do not create shows, tags, or relationship rows. The
command only inserts data and does not clear existing records, so rerunning it
adds another fixture batch.

`bun run db:seed:shows` inserts five standalone show records for local
development. The fixtures intentionally do not create DJs, tags, or relationship
rows. The command only inserts data and does not clear existing records, so
rerunning it adds another fixture batch.

`bun run db:delete:shows -- --confirm` permanently deletes every show and its
cascading relationship rows. The explicit confirmation flag is required.

`bun run db:delete:djs -- --confirm` permanently deletes every DJ. Relationship
rows referencing those DJs are removed by the database's `ON DELETE CASCADE`
constraints. The explicit confirmation flag is required.

`bun run db:delete:mixcloud-imports -- --confirm` permanently deletes every
Mixcloud import tracking row, preserving the table, shows, DJs, tags, and their
relationships. Like the Shows and DJs deletion scripts, it requires `--confirm`
and uses the configured database. Clearing tracking removes duplicate-import
protection; a later refresh can repopulate source rows.

## Authentication tables

Better Auth owns its authentication tables separately from archive entities.
Migration `0007_create_better_auth_tables` creates the `user`, `session`,
`account`, and `verification` tables and their lookup indexes. Migration `0008`
adds the server-owned `user.role` field. The configured application uses the
single `admin` role; Better Auth initializes new accounts with that role while
public sign-up remains disabled. These tables are managed by Better Auth and are
not archive resources.

## Core tables

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
image       text
url         text          -- audio source URL
```

`duration` is measured in whole seconds. `date` represents a broadcast calendar
day and is stored explicitly at midnight UTC, so its timestamp remains
unambiguous without a local-time interpretation.

### `tags`

```text
id          integer primary key
createdAt   timestamptz not null
title       text not null
color       text not null
reviewed    boolean not null default false
mixcloud_key text unique
mixcloud_url text
```

Tags represent genres or other archive labels. Tag titles should have an
appropriate uniqueness rule, normally case-insensitive uniqueness. Tags created
with an automatically generated color are unreviewed; tags created with an
explicit color are marked reviewed.

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

Add `UNIQUE (show_id, dj_id)` to prevent duplicate associations.

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

Add `UNIQUE (show_id, tag_id)`.

### `dj_tags`

Stores tags manually assigned to DJs. These are additional tags and may be
broader than the tags on any individual show.

```text
id          integer primary key
createdAt   timestamptz not null
dj_id       integer not null references djs(id)
tag_id      integer not null references tags(id)
```

Add `UNIQUE (dj_id, tag_id)`.

The database does not need a separate row for a derived DJ tag. During export,
combine the manually assigned `dj_tags` with the distinct tags from every show
linked through `show_djs` and `show_tags`.

## Mixcloud import tracking

Migration `0018_create_mixcloud_import_table` implements the tracking schema
from `human_docs/databases_human.md`. The importer itself remains future work.
This branch includes the WIP parser and launcher. `./scripts/import-mixcloud`
runs `src/db/import-mixcloud.ts`, which reads `src/res/mixcloud.json`, parses
cloudcast names, and prints diagnostics without database writes. Keep that
parsing workflow read-only until the import phase is implemented. The following
documents the tracking schema and future importer requirements; the migration
does not enable imports or add show soft deletion.

### `mixcloud_import`

One row tracks one Mixcloud cloudcast by its exact source `key`.

```text
id          integer generated by default as identity primary key
createdAt   timestamptz not null default CURRENT_TIMESTAMP
key         text not null unique
url         text null
name        text null
created_time timestamptz null
duration    integer null
image_small text null
image_large text null
mixcloud_tag_keys text[] null
data_changed boolean not null default false
show_id     integer null references shows(id) on delete set null
imported_at timestamptz null
```

Migration `0019_add_mixcloud_source_metadata` adds six nullable source fields,
preserving existing rows without a backfill. `url` and `name` retain the source
cloudcast URL and name; `created_time` is Mixcloud's creation timestamp;
`duration` is `audio_length` in seconds; `image_small` and `image_large` are
source image URLs. Refresh maps `pictures.large` to `image_small` and
`pictures["1024wx1024h"]` to `image_large`; both source fields are required by
fetch validation. Existing rows receive the new URLs on their next refresh.
Applying this migration does not run the importer. Migration
`0020_add_mixcloud_tag_keys` adds nullable `mixcloud_tag_keys`, an array of
source genre key strings. Existing rows default to null (unknown); an empty
array represents a cloudcast with no source tags. These are source metadata, not
foreign keys or archive tag IDs.

Migration `0021_add_mixcloud_data_changed` adds `data_changed`, defaulting to
false for existing and new rows. It flags source changes needing review after
import: refresh writes set it when relevant source metadata changes, unchanged
refreshes preserve a set flag, and review clears it. Pending imports remain
identifiable by their null `show_id`. Refresh upserts source metadata by exact
key in one transaction, comparing URL, name, creation time, duration, image
URLs, and tag keys as a set. Missing fetched records are retained. Archive
records and import links are preserved. Review actions and API/UI flag exposure
follow separately. No approved-source snapshot or diff history is stored.
Rollback removes only the flag column and preserves tracking records and links.

`createdAt` follows the archive table convention and records when the tracking
row was created. `imported_at` records the successful database import time, not
Mixcloud's creation time, the broadcast date, or a parsing run's time. It has no
default: pending rows must have both import fields null. There is no stored
`imported` boolean; derive it with `show_id IS NOT NULL`, including when the
referenced show is soft-deleted.

Preserve `entry.key` verbatim in the normalized parsed-show result; the current
`ParsedShow` drops it. Do not substitute the title or URL as the import
identity. The unique constraint on `key` supplies the lookup index and prevents
duplicate tracking rows. Add `mixcloud_import_show_id_idx` on `show_id` to
support lookups and foreign-key actions when shows are deleted. No uniqueness
constraint on `show_id` is required by this design.

### Consistency and deletion

Enforce the paired nullability in PostgreSQL:

```sql
CONSTRAINT mixcloud_import_import_state_check
CHECK ((show_id IS NULL) = (imported_at IS NULL))
```

The foreign key alone clears only `show_id`. Add a row-level
`BEFORE UPDATE OF show_id` trigger on `mixcloud_import` that also clears
`imported_at` whenever the new `show_id` is null. It must execute before the
check constraint is evaluated, including updates caused by `ON DELETE SET NULL`:

```sql
CREATE FUNCTION mixcloud_import_clear_imported_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.show_id IS NULL THEN
        NEW.imported_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER mixcloud_import_clear_imported_at_trigger
BEFORE UPDATE OF show_id ON mixcloud_import
FOR EACH ROW EXECUTE FUNCTION mixcloud_import_clear_imported_at();
```

| Action                | Required effect          |
| --------------------- | ------------------------ |
| Delete a tracking row | Preserve show and        |
|                       | relationships.           |
| Soft-delete a show    | Preserve tracking row,   |
|                       | `show_id`, and           |
|                       | `imported_at`.           |
| Hard-delete a show    | Retain row, `id`, `key`, |
|                       | and `createdAt`; clear   |
|                       | `show_id` and            |
|                       | `imported_at`.           |

The existing `src/db/delete-shows.ts` uses `DELETE FROM shows`, so the foreign
key and trigger handle the drop-all workflow without script-specific cleanup. Do
not replace it with `TRUNCATE ... CASCADE`: truncation does not perform these
row-level delete/update actions and could remove tracking rows. Deleting a
tracking row removes duplicate-import protection for that key. Hard-deleting its
show resets the tracking row to pending; both permit a later reimport.

### Future import workflow

For each source key, insert a pending tracking row using
`ON CONFLICT (key) DO NOTHING`. In a database transaction, lock that row with
`SELECT ... FOR UPDATE` and recheck `show_id`; skip it if already populated.
This serializes concurrent imports for the same key rather than relying only on
an application-level precheck.

Create the show and its required DJ/tag associations, then set `show_id` and
`imported_at` together in that same transaction. Set the timestamp only on a
successful import; reruns must not overwrite an existing import timestamp or
reset an imported row to pending. Roll back all writes from a failed import so
no partial show, relationships, or success marker remains. A pending tracking
row may remain if it was registered before the transaction. Parse failures and
excluded cloudcasts must never be marked imported. Soft-deleted shows remain
imported and must not be recreated automatically.

Tracking data is internal import bookkeeping and must not be included in the
static archive JSON exports. Parse status, error history, and import-run tables
are outside this schema's scope.

### Implementation and verification

Migration `0018` creates the table, index, check constraint, function, and
trigger together after `shows` exists. Do not edit it after it has been applied.
Its rollback drops the tracking table (and its trigger) before dropping the
trigger function, leaving shows untouched. Add
`mixcloud_import: MixcloudImportTable` to `Database` in `src/db/types.ts`, with
`Generated<number>` for `id`, `Generated<Date>` for `createdAt`, `string` for
`key`, `number | null` for `show_id`, and `Date | null` for `imported_at`.

`tests/db/mixcloud-import-migration.test.ts` runs against an explicitly supplied
disposable PostgreSQL database, creates a unique test schema, and removes that
schema afterward. It never falls back to the regular `DATABASE_URL`. Run it
with:

```sh
MIXCLOUD_MIGRATION_TEST_DATABASE_URL=postgres://admin:mixcloud_test_dev@127.0.0.1:55433/archive_mixcloud_test \
  bun test tests/db/mixcloud-import-migration.test.ts
```

Start a disposable PostgreSQL container as described in
[`DATABASE_E2E_TESTING.md`](DATABASE_E2E_TESTING.md), adjusting the database
name, password, and port to match the test URL. Apply migration `0018` to the
regular database only through an explicit migration command; the test does not
apply it there. Focused coverage includes:

- Pending rows default to null import fields; source keys are unique and
  non-null, and nonexistent show references are rejected.
- Both populated fields are accepted; either inconsistent null combination is
  rejected on insert. Clearing `show_id` on update also clears `imported_at`.
- Deleting a tracking row preserves its show and associations.
- Hard-deleting one show clears both import fields only for its tracking rows;
  deleting all shows preserves every tracking row and clears both fields.
- Migration rollback removes the table and function without deleting shows.

When the importer is implemented in a later feature, verify reruns and
concurrent runs create only one show per key, and simulate a failure after show
creation to verify transaction rollback. Verify that a soft-delete update leaves
tracking unchanged once the show's soft-delete representation exists.

## Integrity and indexing

Every relationship column must be a foreign key to its parent table. This
prevents orphaned rows such as a `show_djs` record referring to a nonexistent
show.

Each relationship table should have:

- a primary key, if using a surrogate `id` column;
- a unique constraint on the pair of foreign keys;
- indexes that support both lookup directions.

For example, `UNIQUE (show_id, dj_id)` efficiently supports show-to-DJ lookups.
Add an index beginning with `dj_id` for DJ-to-show lookups:

```sql
CREATE INDEX show_djs_dj_id_idx ON show_djs (dj_id);
CREATE INDEX show_tags_tag_id_idx ON show_tags (tag_id);
CREATE INDEX dj_tags_tag_id_idx ON dj_tags (tag_id);
```

Foreign-key delete behavior must be chosen deliberately. For relationship rows
that should disappear when their parent is deleted, `ON DELETE CASCADE` is
appropriate. Otherwise, use the default restriction behavior and require the
relationships to be removed first.

## Static archive export rules

The exporter produces the DJ/tag portion of the asset layout described in
[`human_docs/databases_human.md`](../human_docs/databases_human.md). All arrays
are ordered deterministically: DJ indexes by title then ID, tags by ID, and
relationship IDs numerically ascending. The command logs its nested progress,
including each generated JSON and image file.

`tags.json` is the canonical tag dictionary. Every other exported document uses
the `tagIds` field rather than duplicating tag titles and colors. The Astro
frontend loads `tags.json` once and resolves those IDs locally. When present, a
tag's `mixcloud_key` and `mixcloud_url` are included in this dictionary as
Mixcloud source metadata.

For a DJ, `tagIds` is the distinct union of:

1. manually assigned tags from `dj_tags`; and
2. tags assigned to that DJ's shows through `show_djs` and `show_tags`.

The DJ detail document embeds the associated shows. Each embedded show includes
its own `tagIds`. The top-level `shows.json` lists shows by descending date then
ID, includes each show's `tagIds`, and embeds compact related DJ cards with
`id`, `title`, and an optional static image path.

The exporter writes stored DJ WebP variants to
`public/assets/djs/{id}_small.webp` and `{id}_large.webp`. DJ indexes and Show
cards use `assets/djs/{id}_small.webp`; DJ details use
`assets/djs/{id}_large.webp`. Export never processes images or writes to the
database. It must never export the private `/api/admin/djs/{id}/image` URL. Show
image values in DJ detail documents are the stored image URLs until show-image
asset storage is added.

The JSON field names and file paths are part of the frontend contract. Keep them
stable even if internal database column names change. Astro frontend code must
prefix file and asset paths with `import.meta.env.BASE_URL`, rather than
assuming the site is deployed at `/`.

## Implementation checklist

When adding the schema:

1. Create the core tables before the relationship tables.
2. Add foreign keys and pairwise unique constraints.
3. Add reverse-lookup indexes for relationship queries.
4. Add migrations rather than modifying an already-applied migration.
5. Update the export logic and this document together when the data contract
   changes.
