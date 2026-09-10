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

DJs: ID | Name | Bio | Image | Shows | Tags
Shows: ID | Name | Date | Duration | DJs | Image | Tags | URL
Tags: ID | Name | Color
