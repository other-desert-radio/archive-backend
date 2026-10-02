# Static Archive Export

Read this when changing exported JSON, image assets, or frontend data contracts.
For schema invariants, see [DATABASES.md](DATABASES.md).

## Output layout

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

## Export rules

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
