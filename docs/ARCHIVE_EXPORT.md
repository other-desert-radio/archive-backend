# Static Archive Export

Read this when changing exported JSON, image assets, or frontend data contracts.
For schema invariants, see [DATABASES.md](DATABASES.md).

## Output layout

The backend stores archive data in PostgreSQL. `bun run publish-locally` writes
the following assets to the configured Astro frontend directories:

- `src/res/djs_brief.json`, the compact DJ index;
- `src/res/djs/{id}.json`, one detail document per DJ;
- `src/res/shows.json`, the top-level show index;
- `src/res/tags.json`, the shared tag dictionary;
- `src/res/data_versions.json`, the dataset version manifest; and
- `public/assets/djs/{id}_small.webp` and `{id}_large.webp`, copied DJ image
  assets.

Astro imports JSON from `src/res/` as part of the site build and copies
`public/assets/` into the deployed site unchanged. The database remains the
source of truth. Arrays of IDs belong in exported documents, not in the primary
entity tables.

## JSON version contract

Every generated data document uses `{ version, updatedAt, data }`. The existing
array or DJ detail object is preserved under `data`; nested records have no
additional version fields. `version` is a positive integer content revision, and
`updatedAt` is a UTC ISO 8601 string. Consumers must unwrap `data` before using
the existing payload. All file paths remain unchanged, including
`src/res/shows.json`; this backend change adds no runtime GET endpoint.

`src/res/data_versions.json` contains the lightweight manifest:

```json
{
  "shows": { "id": 1, "updatedAt": "2026-10-29T12:00:00.000Z" },
  "djs": { "id": 1, "updatedAt": "2026-10-29T12:00:00.000Z" },
  "tags": { "id": 1, "updatedAt": "2026-10-29T12:00:00.000Z" }
}
```

Each manifest `id` matches its data document's `version`. DJ briefs and all DJ
individual documents share the DJ dataset version. Image files retain their
existing paths and binary format; changing their bytes advances the DJ version.
Changes to embedded DJ cards advance the shows version when that payload
changes.

Versions come from PostgreSQL, starting at 1 on first allocation, rather than
from destination files. Unchanged exports preserve versions and timestamps,
including when repairing output after an interrupted write. Empty datasets are
versioned normally. Legacy destination files are replaced with wrapped output;
consumers require a separate compatibility update. See
[dataset version storage](DATABASES.md#archive-dataset-versions) for persistence
and migration requirements.

The manifest is written to a temporary file after all data and image files, then
replaces the previous manifest by rename. This avoids following a manifest
symlink and preserves the previous file if writing the new one fails. The
filesystem export as a whole is not atomic: readers can encounter partial output
during a failed or in-progress export. Database allocation does not indicate
successful publication.

DJ hashing feeds image identity, variant, byte length, and raw bytes into
SHA-256 incrementally; it never serializes image buffers as JSON byte arrays.
Switching from the previous buffer-JSON hash representation advances an existing
DJ version once on its next allocation, even if its public content is unchanged.
Subsequent unchanged exports retain that version.

## Export rules

Show records in `shows.json` and nested DJ detail records include optional
`description` containing sanitized HTML, using the same allowed formatting as DJ
bios. NULL descriptions are omitted; empty descriptions remain empty strings.

The exporter owns the entire `src/res/djs/` and `public/assets/djs/` directories
and replaces their contents on each export, including stale files. Keep manually
maintained assets outside those directories. It also owns the four top-level
generated JSON files; other files such as `src/res/mixcloud.json` and
`public/assets/logo.svg` remain untouched and outside publication commits.

The exporter produces the asset layout above. Original design intent lives in
[historical notes](../human_docs/databases_human.md); this document owns the
current contract. All arrays are ordered deterministically: DJ indexes by title
then ID, tags by ID, and relationship IDs numerically ascending. The command
logs its nested progress, including each generated JSON and image file.

Standalone exports read all six archive tables and allocate dataset versions in
one repeatable-read transaction under the shared exporter lock. The same session
holds the lock until all data, images, and the manifest are written. Publisher
execution takes that same lock before checkout validation and holds it through
synchronization, staging, commit, push, and acknowledgement. A standalone export
therefore cannot overwrite files while the publisher is preparing its commit,
and overlapping standalone exports cannot interleave writes. Concurrent
committed edits cannot mix different versions of DJs, Shows, Tags,
relationships, or images in a single export. Documents are built inside that
transaction, then files are written after it completes. A failed read leaves
existing output untouched; filesystem failures during writing can still leave
partial output.

The publisher's `readPublicationSnapshot` reads the singleton revision first,
then loads the archive documents in that same read-only transaction for
previews. Changes committed after the snapshot remain pending for a later
publication. Snapshot reads do not acknowledge revisions or write files. The
standalone exporter uses the same document loader without requiring the
publication-state table.

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
processes images or modifies archive records; it writes dataset version metadata
to the database. It must never export the private `/api/admin/djs/{id}/image`
URL. All exported Show documents, including `shows.json` and shows embedded in
DJ details, expose the stored `mixcloud_image_small` and `mixcloud_image_large`
URLs through `image_small` and `image_large` and omit the legacy JSON `image`
field. Migration `0024` removes the legacy database `image` column. The nullable
binary show image columns added by `0037` are reserved for future uploads and
are not exported.

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

Preparation leaves working-tree files, HEAD, and the Git index untouched. It
does not allocate dataset versions. On confirmation, allocation and recording of
the captured revision and dataset versions on the job share one transaction
under the exporter lock. Reviewed documents stay fixed even when edits commit
after confirmation; execution without a preview loads the revision and documents
inside that locked transaction. Remote-tracking refs can update during fetch.
Local preparation works with non-Git destinations and makes no network requests.
Unrelated checkout files stay outside the comparison; symlinks in managed local
output are rejected.

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
acknowledgement. The retry job inherits the recovered job's recorded dataset
versions without allocating against current data or changing the latest dataset
state. Legacy jobs without a dataset snapshot retain that absence during
recovery. Local retries prepare a fresh reviewed snapshot and allocate versions
for its content. Newer archive edits remain pending after remote recovery.

Publication logs include the captured archive revision and each dataset's
version number, visible in the existing admin log UI. Recovery logs the original
revision and dataset versions; legacy jobs explicitly report unavailable dataset
metadata.

It stages only generated JSON (including `data_versions.json`) and DJ image
paths, including deletions, commits changed output with a job identifier, and
pushes without force. It acknowledges only the captured revision after success
or a no-change result; newer edits remain pending. Unrelated assets and edits
remain outside the generated-file commit. Durable jobs allow explicit recovery
after restart or a lost response from the Git remote. See
[publication operations](DEVELOPMENT.md#publication-operation-and-recovery) for
setup, branch selection, and retry procedures.
