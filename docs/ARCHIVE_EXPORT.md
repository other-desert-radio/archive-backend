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

The exporter produces the asset layout above. Original design intent lives in
[historical notes](../human_docs/databases_human.md); this document owns the
current contract. All arrays are ordered deterministically: DJ indexes by title
then ID, tags by ID, and relationship IDs numerically ascending. The command
logs its nested progress, including each generated JSON and image file.

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
`shows.json` and shows embedded in DJ details, expose the stored URLs through
`image_small` and `image_large` and omit the legacy JSON `image` field.
Migration `0024` removes the legacy database `image` column.

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
unset, this standalone command retains the sibling `../archive-site`
destination; the server publisher's separate default is `../clean-archive-site`.
The tracked `.env.example` explicitly selects `../clean-archive-site`, so
copying that setting overrides the standalone fallback. Other publication
settings do not affect this export-only command. The reusable exporter module
and its tests retain their `export-archive` names.

The CLI acceptance test in `tests/db/export-archive.test.ts` uses
`ARCHIVE_EXPORT_TEST_DATABASE_URL` pointing at disposable PostgreSQL, creates a
temporary schema and output directory, and verifies export and unchanged
publication revisions. It skips that test when the variable is unset.
