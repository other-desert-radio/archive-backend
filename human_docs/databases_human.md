# Database Notes

The archive front end that plugs into this is a GitHub static site.

It will source data from static JSON files included in the GitHub repo.

This backend will convert PostgreSQL data into static assets for the frontend.
The exporter writes JSON and images to separate absolute directories configured
in the backend code:

```text
archive-site/
├── src/res/
│   ├── djs_brief.json
│   ├── djs/
│   │   └── 1.json
│   ├── shows.json
│   └── tags.json
└── public/assets/
    └── djs/
        ├── 1_small.webp
        └── 1_large.webp
```

Astro imports JSON from `src/res/` during its site build. It copies
`public/assets/` into the built site unchanged, so the frontend must construct
image URLs with Astro's `import.meta.env.BASE_URL`, which supports GitHub Pages
project sites whose site URL includes the repository name.

## `djs_brief.json`

The scrolling DJ list loads this compact index.

```json
[
  {
    "id": 1,
    "title": "DJ Example",
    "image": "assets/djs/1_small.webp",
    "tagIds": [2, 4]
  }
]
```

## `djs/{id}.json`

Selecting a DJ loads this detail document. Each embedded show includes enough
metadata for the DJ page; `tagIds` are resolved through the shared `tags.json`
dictionary.

```json
{
  "id": 1,
  "title": "DJ Example",
  "bio": "<p>Safe HTML</p>",
  "image": "assets/djs/1_large.webp",
  "shows": [
    {
      "id": 10,
      "title": "Example Show",
      "date": "2026-01-01T00:00:00.000Z",
      "duration": 1234,
      "image": "https://example.com/show-image.jpg",
      "tagIds": [2, 4],
      "url": "https://example.com/audio"
    }
  ],
  "tagIds": [2, 4]
}
```

## `shows.json`

This document powers the scrolling show list and embeds the small DJ card data
needed for display; its `tagIds` are resolved through `tags.json`. Shows are
ordered by descending date, then ID; related DJ and tag IDs are ascending.

```json
[
  {
    "id": 10,
    "title": "Example Show",
    "date": "2026-01-01T00:00:00.000Z",
    "duration": 1234,
    "djs": [
      {
        "id": 1,
        "title": "DJ Example",
        "image": "assets/djs/1_small.webp"
      }
    ],
    "image": "https://example.com/show-image.jpg",
    "tagIds": [2, 4],
    "url": "https://example.com/audio"
  }
]
```

## `tags.json`

This is the canonical, shared tag dictionary. The frontend downloads it once,
indexes it by `id`, and resolves every `tagIds` array against it.

```json
[
  {
    "id": 2,
    "title": "House",
    "color": "#ff1100"
  }
]
```

## DJ images

The database stores only two derived WebP image columns for each DJ:

- `image_small`: an exact 400 by 400 WebP, used in the DJ index and show cards.
- `image_large`: an exact 1024 by 1024 WebP, used on the DJ detail page.

The two values are stored as a pair; a DJ either has both variants or neither.
The source upload and its filename are not retained. Admins can select JPEG,
PNG, or WebP source files. The browser lets them crop, zoom, and rotate the
image, then submits a square WebP. The backend produces and stores the two final
WebPs. There is no image-byte upload limit in this workflow.

## Database tables

```text
DJs: ID | Title | Bio | image_small | image_large | Socials | Show Title |
     Show Description
Shows: ID | Title | Date | Duration | Image | URL
Tags: ID | Title | Color | Reviewed
```

Show_DJs: ID | show_id | dj_id show_id FOREIGN KEY -> Shows.ID dj_id FOREIGN KEY
-> DJs.ID UNIQUE(show_id, dj_id)

> this maps a show to a DJ id, a show can have multiple DJs: ID | show_id |
> dj_id 1 | 5 | 2 2 | 5 | 3

Show_Tags: ID | show_id | tag_id show_id FOREIGN KEY -> Shows.ID tag_id FOREIGN
KEY -> Tags.ID UNIQUE(show_id, tag_id)

DJ_Tags: ID | dj_id | tag_id dj_id FOREIGN KEY -> DJs.ID tag_id FOREIGN KEY ->
Tags.ID UNIQUE (dj_id, tag_id)

these are the manual tags added to a dj. When generating JSON, combine a DJ’s
manual tags with the distinct tags assigned to any show associated with that DJ
through Show_DJs.

For example, the Show_DJs table can be created with foreign keys like this:

```sql
CREATE TABLE show_djs (
    id SERIAL PRIMARY KEY,
    show_id INTEGER NOT NULL REFERENCES shows(id),
    dj_id INTEGER NOT NULL REFERENCES djs(id),
    UNIQUE (show_id, dj_id)
);
```

The foreign keys ensure that every show_id and dj_id in Show_DJs refers to an
existing show or DJ, preventing orphaned relationships.

## Mixcloud import

`./scripts/import-mixcloud` is used to import data from mixcloud. it may be run
multiple times.

every mixcloud show has a `key`. we use that to create this table:

id | key (from mixcloud) | show_id (null unless imported into an actual show) |
imported_at (null unless imported into an actual show)

- key is UNIQUE

deletion stratergy: Action Effect ━━━━━━━━━━━━━━━━━━━━━━
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ Delete an import row
Show stays untouched ──────────────────────
───────────────────────────────────────────────────────── Soft-delete a show
Import row stays unchanged ──────────────────────
───────────────────────────────────────────────────────── Hard-delete a show
Import row remains; show_id and imported_at become null
