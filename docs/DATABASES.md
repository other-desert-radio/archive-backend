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
dataset. Better Auth tables have their own independently managed `createdAt`
columns.

All relationship foreign keys will use `ON DELETE CASCADE`. Deleting a DJ, show,
or tag will therefore remove its dependent relationship rows automatically.

The current effort is limited to the PostgreSQL schema, migrations, and typed
database wiring. The JSON exporter and its sanitization logic are out of scope
until the schema has been built and reviewed.

## Purpose

The backend stores archive data in PostgreSQL. An export process converts the
relational data into three static JSON files for the GitHub-hosted frontend:

- `djs.json`
- `shows.json`
- `tags.json`

The database is the source of truth. Arrays of IDs belong in the exported JSON
format, not in the primary entity tables.

## Local dummy data

`bun run db:seed:djs` inserts five standalone DJ records for local development.
The fixtures intentionally do not create shows, tags, or relationship rows. The
command only inserts data and does not clear existing records, so rerunning it
adds another fixture batch.

`bun run db:delete:djs -- --confirm` permanently deletes every DJ. Relationship
rows referencing those DJs are removed by the database's `ON DELETE CASCADE`
constraints. The explicit confirmation flag is required.

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
image       bytea
image_filename text
socials     text
showTitle   text
showDescription text
```

`bio` and `socials` may contain limited HTML. Both are sanitized before they are
exposed to the frontend; supported formatting is paragraphs, line breaks,
strong/emphasis text, and basic lists.

`showTitle` and `showDescription` are optional plain-text metadata fields. Blank
values are stored as `NULL` and nullable values are omitted from JSON output.

`image` stores the original uploaded file bytes without compression. The
short-term upload contract accepts JPEG, PNG, and WebP files up to 10 MiB.
`image_filename` stores sanitized filename metadata, including the normalized
extension. Future work will convert uploads to WebP before storage.

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

`duration` is measured in whole seconds. `date` should retain timezone
information so the exported value is unambiguous.

### `tags`

```text
id          integer primary key
createdAt   timestamptz not null
title       text not null
color       text not null
reviewed    boolean not null default false
```

Tags represent genres or other archive labels. Tag titles should have an
appropriate uniqueness rule, normally case-insensitive uniqueness. Tags created
with an automatically generated color are unreviewed; tags created with an
explicit color are marked reviewed.

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

## JSON export rules

The exporter should produce top-level arrays. Relationship arrays are derived
from the mapping tables:

```json
{
  "id": 1,
  "title": "Example DJ",
  "shows": [5, 8],
  "tags": [2, 4, 7]
}
```

For a DJ, `shows` comes from `show_djs`. `tags` is the distinct union of:

1. manually assigned tags from `dj_tags`; and
2. tags assigned to that DJ's shows through `show_djs` and `show_tags`.

Duplicate tag IDs must be removed in the exported array.

For a show, `djs` comes from `show_djs`, and `tags` comes from `show_tags`.

The JSON field names are part of the frontend contract. Keep them stable even if
internal database column names change.

## Implementation checklist

When adding the schema:

1. Create the core tables before the relationship tables.
2. Add foreign keys and pairwise unique constraints.
3. Add reverse-lookup indexes for relationship queries.
4. Add migrations rather than modifying an already-applied migration.
5. Update the export logic and this document together when the data contract
   changes.
