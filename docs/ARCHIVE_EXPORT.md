# Static Archive Export

Read this when changing exported JSON, image assets, or frontend data contracts.
For schema invariants, see [DATABASES.md](DATABASES.md).

## Output layout

The backend stores archive data in PostgreSQL. `bun run publish-locally` writes
the following assets to the configured Astro frontend directories:

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

## Export rules

The exporter owns the entire `src/res/djs/` and `public/assets/djs/` directories
and replaces their contents on each export, including stale files. Keep manually
maintained assets outside those directories. It also owns the three top-level
generated JSON files; other files such as `src/res/mixcloud.json` and
`public/assets/logo.svg` remain untouched and outside publication commits.

The exporter produces the asset layout above. Original design intent lives in
[historical notes](../human_docs/databases_human.md); this document owns the
current contract. All arrays are ordered deterministically: DJ indexes by title
then ID, tags by ID, and relationship IDs numerically ascending. The command
logs its nested progress, including each generated JSON and image file.

Archive reads use one read-only, repeatable-read transaction for all six archive
tables. Concurrent committed edits cannot mix different versions of DJs, Shows,
Tags, relationships, or images in a single export. Documents are built inside
that transaction, then files are written after it completes. A failed read
leaves existing output untouched; filesystem failures during writing can still
leave partial output.

The publisher's `readPublicationSnapshot` reads the singleton revision first,
then loads the archive documents in that same transaction. Changes committed
after the snapshot remain pending for a later publication. Snapshot reads do not
acknowledge revisions or write files. The standalone exporter uses the same
document loader without requiring the publication-state table.

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
`id`, `title`, and optional static `image_small` and `image_large` paths.

The exporter writes stored DJ WebP variants to
`public/assets/djs/{id}_small.webp` and `{id}_large.webp`. DJ indexes and Show
cards expose both variants through `image_small` and `image_large`, pointing to
`assets/djs/{id}_small.webp` and `assets/djs/{id}_large.webp` respectively. DJ
details use the same fields. Both fields are omitted for DJs without images.
Exported DJ objects do not include the legacy `image` field. Export never
processes images or writes to the database. It must never export the private
`/api/admin/djs/{id}/image` URL. All exported Show documents, including
`shows.json` and shows embedded in DJ details, expose the stored
`mixcloud_image_small` and `mixcloud_image_large` URLs through `image_small` and
`image_large` and omit the legacy JSON `image` field. Migration `0024` removes
the legacy database `image` column. The nullable binary show image columns added
by `0037` are reserved for future uploads and are not exported.

The JSON field names and file paths are part of the frontend contract. Keep them
stable even if internal database column names change. Astro frontend code must
prefix file and asset paths with `import.meta.env.BASE_URL`, rather than
assuming the site is deployed at `/`.

`scripts/publish-locally` replaces the former `scripts/export-archive` launcher;
the package command is now `publish-locally`. It exports only: it does not
commit, push, or acknowledge publication revisions, and does not require a Git
checkout. It preserves the existing progress output and unrelated assets.

Set `ARCHIVE_CHECKOUT_PATH` to choose the destination checkout. Relative paths
resolve from this backend repository root, regardless of the launcher's working
directory. JSON goes to `<checkout>/src/res` and images to
`<checkout>/public/assets`. The checkout must be separate from the backend. When
unset or blank, export fails with a setting-specific error. There is no
hardcoded checkout fallback. The tracked `.env.example` selects
`../archive-site` for local development. Other publication settings do not
affect this export-only command. The reusable `export-archive` module owns
snapshot reads, document building, and file writing; its tests use the same
name.

The CLI acceptance test in `tests/db/export-archive.test.ts` uses
`ARCHIVE_EXPORT_TEST_DATABASE_URL` pointing at disposable PostgreSQL, creates a
temporary schema and output directory, and verifies export and unchanged
publication revisions. A separate snapshot test interleaves committed edits
between reads, checks matching revision/documents and fresh subsequent reads,
and verifies recovery after read failures. Both skip when the variable is unset.

## Server publication

The admin publisher uses this same exporter. Local mode validates its existing
checkout and writes assets without fetch, branch changes, commit, or push. It
records optional read-only Git metadata and acknowledges the captured revision
after a successful write. Both modes prepare a simple summary of added, changed,
and removed names for Tags, Shows, and DJs. Local mode reads current generated
checkout files; remote mode reads the fetched branch. Changes in metadata,
relationships, or DJ image bytes count as changed records. Ordering and
duplicate embedded record details are suppressed.

Preparation leaves working-tree files, HEAD, and the Git index untouched.
Remote-tracking refs can update during fetch. Local preparation works with
non-Git destinations and makes no network requests. Unrelated checkout files
stay outside the comparison; symlinks in managed local output are rejected.

The backend retains reviewed archive documents in memory for up to 15 minutes,
with at most eight previews per process. No temporary preview files are created.
Confirmation validates ownership, target, database revision, and the baseline
before creating a job. Local mode checks current generated-file contents; remote
mode checks the fetched branch commit. Changed baselines require a fresh
preview. The existing exporter writes the reviewed documents after confirmation,
and newer database edits remain pending. Restart requires preparing a new
summary.

Remote retry preserves existing commit recovery: a recognized outgoing commit is
summarized against origin and resumed; a push already on origin only needs
acknowledgement. Newer archive edits remain pending after recovery.

It stages only generated JSON and DJ image paths, including deletions, commits
changed output with a job identifier, and pushes without force. It acknowledges
only the captured revision after success or a no-change result; newer edits
remain pending. Unrelated assets and edits remain outside the generated-file
commit. Durable jobs allow explicit recovery after restart or a lost response
from the Git remote. See
[publication operations](DEVELOPMENT.md#publication-operation-and-recovery) for
setup, branch selection, and retry procedures.
