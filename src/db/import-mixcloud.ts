import mixcloudCloudcastsJson from "../res/mixcloud.json" with { type: "json" };

export type MixcloudPictures = Record<string, string>;

export type MixcloudTag = {
  key: string;
  url: string;
  name: string;
};

export type MixcloudUser = {
  key: string;
  url: string;
  name: string;
  username: string;
  pictures: MixcloudPictures;
};

export type MixcloudCloudcast = {
  key: string;
  url: string;
  name: string;
  tags: MixcloudTag[];
  created_time: string;
  updated_time: string;
  play_count: number;
  favorite_count: number;
  comment_count: number;
  listener_count: number;
  repost_count: number;
  pictures: MixcloudPictures;
  slug: string;
  user: MixcloudUser;
  hosts: unknown[];
  audio_length: number;
};

export type MixcloudCloudcasts = {
  data: MixcloudCloudcast[];
  paging: {
    next: string;
    previous: string;
  };
  name: string;
};

export const mixcloudCloudcasts: MixcloudCloudcasts = mixcloudCloudcastsJson;
/*
```json
[
  {
    "id": 10,
    "title": "Example Show",
    "date": "2026-01-01T00:00:00.000Z",
    "duration": 1234,
    "djs": [{ "id": 1, "title": "DJ Example", "image": "assets/djs/1.jpg" }],
    "image": "https://example.com/show-image.jpg",
    "tagIds": [2, 4],
    "url": "https://example.com/audio"
  }
]
```
*/

if (import.meta.main) {
  console.log(`Loaded ${mixcloudCloudcasts.data.length} Mixcloud shows.`);

  for (const entry of mixcloudCloudcasts.data) {
    const { djName, title, date } = parseShowName(entry.name); // "Derek Monypeny' - Freedom Overspill Radio Hour #32, Sudanese 60s-70s, September 7, 2026",
    const convertedDate = convertDate(date);

    console.log(
      `parsed ${entry.name}\n\t${djName}\n\t${title}\n\t${date}\t${convertedDate}`,
    );
  }
}
