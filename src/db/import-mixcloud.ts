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
};

export const mixcloudCloudcasts: MixcloudCloudcasts = mixcloudCloudcastsJson;

type ParsedShowName = {
  djName: string;
  title: string;
  date?: string;
};

const red = (text: string): string => `\u001b[31m${text}\u001b[0m`;

type ParsedShow = {
  djName: string;
  title: string;
  date: string;
  convertedDate: string;
  dateSource: string;
  parser: ParserMetadata;
};

type ParserMetadata = {
  index: number;
  name: string;
};

type ParseShowNameResult =
  | {
      status: "success";
      data: ParsedShowName;
      parser: ParserMetadata;
    }
  | {
      status: "failure";
      name: string;
    };

type ShowNameParser = {
  name: string;
  parse: (name: string) => ParsedShowName | undefined;
};

const parseWithPattern = (name: string, pattern: RegExp): ShowNameParser => ({
  name,
  parse: (value) => {
    const match = pattern.exec(value);
    return match?.groups as ParsedShowName | undefined;
  },
});

const parseShowNameAttempts: Array<ShowNameParser & { index: number }> = [
  // trailing-apostrophe DJ name with month and year
  // "Andrew Storrs' From the Vault 5 - Terry Allen LIVE @ Zebulon LA, February 2020"
  parseWithPattern(
    "trailing-apostrophe DJ name with month and year",
    /^(?<djName>.+?)' (?<title>.+), (?<date>[A-Z][a-z]+ \d{4})$/,
  ),

  // possessive DJ name
  // "Ethan Primason's Yugoslav Special - August 10, 2020"
  // "K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't",
  // Drop the possessive suffix and use the remaining text as the show title.
  parseWithPattern(
    "possessive DJ name with date",
    /^(?<djName>.+?)'s (?<title>.+) - (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
  ),
  // The common case
  // "Ethan - Side A, April 6, 2020"
  parseWithPattern(
    "common comma date",
    /^(?<djName>.+?) - (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
  ),

  // hyphen divider
  // "Caroline - Mojave Window Optics pt. 2 - June 1, 2020"
  parseWithPattern(
    "hyphen date",
    /^(?<djName>.+?) - (?<title>.+) - (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
  ),

  // colon divider
  // Justin Paszul: An Evening of Stand-Up Cosmogony, Hour #1, March 3, 2025
  parseWithPattern(
    "colon date",
    /^(?<djName>.+?): (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
  ),

  // broadcast date suffix
  // "Ethan and Caroline - 24 Hour Drone Live Set 2020, Broadcast on April 25, 2020"
  parseWithPattern(
    "broadcast date",
    /^(?<djName>.+?) - (?<title>.+), Broadcast on (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
  ),

  // possessive DJ name without a date
  // "K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't"
  parseWithPattern(
    "possessive DJ name without date",
    /^(?!.*[A-Z][a-z]+ \d{1,2}, \d{4}$)(?<djName>.+?)'s (?<title>.+ - .+)$/,
  ),

  // hypen divider, no date
  // Florina - ASEDR 6
  // NATIONWIDEONYRSIDE - Tight Joints Cousin - Side B 2019
  parseWithPattern("hyphen without date", /^(?<djName>.+?) - (?<title>.+)$/),

  // "NATIONWIDEONYRSIDE - Live at Lander's Brew - Side B 2019",
  // apostorpohe in the show title
].map((parser, index) => ({ ...parser, index: index + 1 }));

const parseShowName = (name: string): ParseShowNameResult => {
  for (const parseAttempt of parseShowNameAttempts) {
    const data = parseAttempt.parse(name);
    if (data) {
      return {
        status: "success",
        data,
        parser: { index: parseAttempt.index, name: parseAttempt.name },
      };
    }
  }

  // regex Failed!

  // parse via known DJ name
  // "Pequeña Cretina Volume IV, November 27, 2023"
  // "Mellow and Normal Ep. 3, August 8, 2022"
  // "Temporal Emissions Episode 7: December 22, 2025"
  const knownDJs = [
    "Pequeña Cretina",
    "Temporal Emissions",
    "Mellow and Normal",
    "Dev.01d",
  ];

  for (const knownDJ of knownDJs) {
    const escapedDJ = knownDJ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const knownDJPattern = new RegExp(
      `^(?<djName>${escapedDJ})(?:\\s*-\\s*|\\s+)(?<title>.+?)[,:] (?<date>[A-Z][a-z]+ \\d{1,2}, \\d{4})$`,
    );
    const data = parseWithPattern("known DJ name", knownDJPattern).parse(name);

    if (data) {
      return {
        status: "success",
        data,
        parser: {
          index: parseShowNameAttempts.length + 1,
          name: "known DJ name",
        },
      };
    }
  }

  return { status: "failure", name };
};

const convertDate = (date: string): string =>
  new Date(`${date} UTC`).toISOString();
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

  const collection: ParsedShow[] = [];
  const parseFailures: string[] = [];
  for (const entry of mixcloudCloudcasts.data) {
    const parsedShowName = parseShowName(entry.name);

    if (parsedShowName.status === "failure") {
      parseFailures.push(parsedShowName.name);
      continue;
    }

    const { djName, title, date } = parsedShowName.data;
    const { parser } = parsedShowName;
    const dateSource = date ? "parsed" : "fallback";
    const showDate = date ?? entry.created_time;
    const convertedDate = date
      ? convertDate(date)
      : new Date(entry.created_time).toISOString();

    console.log(
      `parsing "${entry.name}",\n | parser: ${parser.index} (${parser.name})\n | dj_name: ${djName}\n | title: ${title}\n | date: ${showDate}\n | converted_date: ${convertedDate}\n | date_source: ${dateSource}\n\n`,
    );

    collection.push({
      djName,
      title,
      date: showDate,
      convertedDate,
      dateSource,
      parser,
    });
  }

  console.log(
    collection
      .sort((e1, e2) => e1.djName.localeCompare(e2.djName))
      .map((e) => `${e.djName} ---------------------- ${e.title}`)
      .join("\n"),
  );
  const djCounts = new Map<string, number>();
  for (const { djName } of collection) {
    djCounts.set(djName, (djCounts.get(djName) ?? 0) + 1);
  }

  console.log(
    [...djCounts]
      .sort(([firstName], [secondName]) => firstName.localeCompare(secondName))
      .map(([djName, count]) => `${djName} | ${count}`)
      .join("\n"),
  );

  for (const name of parseFailures) {
    console.error(red(`Failed to parse show name: "${name}"`));
  }

  const fallbacks = collection.filter(
    (entry) => entry.dateSource === "fallback",
  );
  const fallbackParserCounts = new Map<
    number,
    { parser: ParserMetadata; count: number }
  >();
  for (const entry of fallbacks) {
    const existing = fallbackParserCounts.get(entry.parser.index);
    fallbackParserCounts.set(entry.parser.index, {
      parser: entry.parser,
      count: (existing?.count ?? 0) + 1,
    });
  }

  console.log(`\nsuccess count: ${collection.length}`);
  console.error(red(`failure count: ${parseFailures.length}`));
  console.error(
    red(
      `fallback date count: ${fallbacks.length}\n${[
        ...fallbackParserCounts.values(),
      ]
        .sort(
          ({ parser: first }, { parser: second }) => first.index - second.index,
        )
        .map(
          ({ parser, count }) =>
            ` | parser ${parser.index} (${parser.name}): ${count}`,
        )
        .join("\n")}`,
    ),
  );
}
