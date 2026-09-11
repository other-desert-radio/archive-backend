# Database Notes

The archive front end that plugs into this is a GitHub static site.

It will source data from static JSON files included in the GitHub repo.

This backend will convert tables in the PostgreSQL database into three JSON
files for the front end to consume:

1. `djs.json`

```json
[{
    id: 1,
    title: "name",
    bio: "safe html",
    image: "image_url",
    shows: [id, id, id],
    tags: [id, id, id]
}, ... ]
```

1. `shows.json`

```json
[{
    id: 1,
    title: "title",
    date: "date",
    duration: 1234, // in seconds
    djs: [id],
    image: "...",
    tags: [id, id],
    url: "string", // where audio comes from
}, ...]
```

1. `tags.json`

```json
[{
    id: 1,
    name: "saad",
    color: "#FF1100"
}, ... ]
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
