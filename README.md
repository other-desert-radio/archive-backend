# Other Desert Radio Backend

This is the backend repo for Other Desert Radio's new archive page.

the database, backend, and admin UI live here.

[Other Desert Radio](https://otherdesertradio.com/)

## Data

The data captured by this gets exported into json files for the static front end
to consume:

<details>
<summary><code>dj_brief.json</code></summary>

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

</details>

<details>
<summary><code>djs/{id}.json</code></summary>

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

</details>

<details>
<summary><code>shows.json</code></summary>

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

</details>

<details>
<summary><code>tags.json</code></summary>

```json
[
  {
    "id": 2,
    "title": "House",
    "color": "#ff1100"
  }
]
```

</details>
