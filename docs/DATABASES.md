# Database Structure

Read this when changing archive tables, relationships, migrations, or typed
database wiring. Read only the linked workflow guidance relevant to the task:

- [Mixcloud tracking and imports](MIXCLOUD_IMPORT.md): source metadata, refresh
  persistence, import state, deletion, and future import transactions.
- [Mixcloud parser](MIXCLOUD_PARSER.md): matchers, DJ names, date suggestions,
  and read-only diagnostics.
- [Static archive export](ARCHIVE_EXPORT.md): JSON contracts and image assets.
- [Development commands](README.md#commands-and-checks): seed and delete
  scripts.
- [Database testing](DATABASE_E2E_TESTING.md): disposable PostgreSQL setup.
- [Human design notes](../human_docs/databases_human.md): intent and plans.

## Sources of truth and migration conventions

Confirm current schema in `src/db/migrations/` and application types in
`src/db/types.ts`. PostgreSQL is the source of truth; exported ID arrays are
frontend representations, not primary entity storage.

Build changes incrementally in dependency order and stop for review after each
small feature. Add migrations rather than editing already-applied migrations.
Apply reviewed migrations explicitly, one step at a time; API startup checks
connectivity and does not run migrations. Commands are in the
[development guide](README.md#local-environment-and-startup).

Archive tables use `createdAt timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP`.
Existing rows received the migration time when this column was introduced.
Authentication tables manage their own creation timestamps.

Relationship foreign keys use `ON DELETE CASCADE`. Deleting a DJ, show, or tag
removes dependent association rows. Mixcloud tracking uses `ON DELETE SET NULL`
and a trigger to retain source rows and clear their import timestamps; see the
[tracking deletion contract](MIXCLOUD_IMPORT.md#consistency-and-deletion).

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
image_large text not null -- image URL
image_small text not null -- image URL
url         text          -- audio source URL
```

`duration` is measured in whole seconds. `date` represents a broadcast calendar
day and is stored explicitly at midnight UTC, so its timestamp remains
unambiguous without a local-time interpretation.

Migration `0023_add_show_image_urls` copies `image` into both new URL columns,
then enforces `NOT NULL`. Existing `NULL` images must be filled before applying
it; otherwise the migration fails and the migrator rolls back the transaction.
Rollback drops only the new columns and preserves `image`. There are no defaults
or URL-format constraints. Show create/edit routes and dummy seeds supply both
columns. Migration `0024_drop_show_image` then removes the legacy `image`
column. Apply migrations through `0024` before running the updated application.
Public JSON retains its `image` field by reading `image_large`. Rolling back
`0024` restores `image` from the current large URL; distinct legacy values are
not recoverable.

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
conflict handling follow the [API conventions](api-routes.md); do not assume a
database uniqueness constraint. Tags created with an automatically generated
pastel color are unreviewed; tags created with an explicit color are marked
reviewed. Automatic colors use hue 0–360°, saturation 45–65%, and lightness
78–86%, persisted as lowercase `#rrggbb`. Reused tags retain their stored colors
and review status; existing records are not recolored.

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
