# Database Notes

The archive front end that plugs into this is a GitHub static site.

It will source data from static JSON files included in the GitHub repo.

This backend will convert PostgreSQL data into static assets for the frontend.
The exporter writes the DJ/tag portion of this layout to an absolute directory
configured in the backend code. Set that directory to the Astro repository's
`public/archive/` directory when exporting directly into the frontend project:

```text
archive-export/
├── djs_brief.json
├── djs/
│   └── 1.json
├── tags.json
└── images/
    └── djs/
        └── 1.jpg
```

The top-level `shows.json` is deferred. When the assets are published to the
Astro repository, they belong in `public/archive/`. Astro copies `public/` into
the built site unchanged, so the files are available beneath `archive/`. The
frontend must construct URLs with Astro's `import.meta.env.BASE_URL`, which
supports GitHub Pages project sites whose site URL includes the repository name.

## `djs_brief.json`

The scrolling DJ list loads this compact index.

```json
[
  {
    "id": 1,
    "title": "DJ Example",
    "image": "images/djs/1.jpg",
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
  "image": "images/djs/1.jpg",
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

This document is planned but is not written by the current exporter. It will
power the scrolling show list and embed the small DJ card data needed for
display; its `tagIds` will be resolved through `tags.json`.

```json
[
  {
    "id": 10,
    "title": "Example Show",
    "date": "2026-01-01T00:00:00.000Z",
    "duration": 1234,
    "djs": [{ "id": 1, "title": "DJ Example", "image": "images/djs/1.jpg" }],
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

The database tables on the backend will be:

DJs: ID | Title | Bio | Image Shows: ID | Title | Date | Duration | Image | URL
Tags: ID | Title | Color

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
