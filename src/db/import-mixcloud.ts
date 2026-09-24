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

/** Format an application error message in red terminal text. */
const red = (text: string): string => `\u001b[31m${text}\u001b[0m`;

/** Format parser diagnostics in gray terminal text. */
const gray = (text: string): string => `\u001b[90m${text}\u001b[0m`;

type ParsedShow = {
  djNames: string[];
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

/**
 * Create a named parser backed by a regular expression with named captures.
 * The parser name is retained so successful matches can be audited later.
 */
const parseWithPattern = (name: string, pattern: RegExp): ShowNameParser => ({
  name,
  parse: (value) => {
    const match = pattern.exec(value);
    return match?.groups as ParsedShowName | undefined;
  },
});

const knownDJNames = [
  "Pequeña Cretina",
  "Temporal Emissions",
  "Mellow and Normal",
  "Dev.01d",
];

// Exact cloudcast names that must remain unparsed and be reported as failures.
// Check this list before constructing or running any parser.
const excludedShowNames = new Set([
  "Looking Glass with Lodi Dottie Episode 7, August 3, 2026",
  "Looking Glass with Lodi Dottie Episode 6:  Heart of the Mojave and beyond ♡, February 23, 2025",
  "Looking Glass with Lodi Dottie Episode 5: Discoween Special, October 28, 2024",
  "Looking Glass with Lodi Dottie Episode 4, August 26, 2024",
  "Looking Glass with Lodi Dottie Episode 3, April 15, 2023",
  "Looking Glass with Lodi Dottie Episode 2, October 2, 2023",
  "Looking Glass with Lodi Dottie Episode 1, August 7, 2023",
  "K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't",
]);

// Exact parsed DJ names can be renamed to one DJ or split into multiple DJs.
const manualDJOverrides = new Map<string, string | string[]>([
  ["Caroline + Ethan", ["Caroline", "Ethan"]],
  ["Caroline and Ethan", ["Caroline", "Ethan"]],
  ["Ethan and Caroline", ["Caroline", "Ethan"]],
  ["Tara Jane O'Neil (TJO)", "Tara Jane O'Neil"],
  ["Lodi Dottie X Muzizmu", ["Lodi Dottie", "Muzizmu"]],
  ["Modular Monday (prepared by Caroline)", "Modular Monday"],
  [
    "Pequeña Cretina + Axaxaxas Mlö (Justin Paszul)",
    ["Pequeña Cretina", "Justin Paszul"],
  ],

  ["HQ Pequeña Cretina", "Pequeña Cretina"],
  ["K Serah Sarah", "K Sera Sarah"],
  ["Lodi Dottie X Peacetime Product B2B", ["Lodi Dottie", "Peacetime Product"]],
  ["Nazmi + Caroline", ["Nazmi", "Caroline"]],
  ["Nathan Ober aka DJ NASTY NATE", "Nathan Ober"],
  ["Peacetime Product X Lodi Dottie B2B", ["Peacetime Product", "Lodi Dottie"]],
  [
    "John Zoon (hans f wagner) and General Baby (jon nielson)",
    "Hans F. Wagner",
    "Jon Nielson",
  ],
]);

/** Escape a literal DJ name before embedding it in a dynamic regular expression. */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Keep specific parsers above broad fallbacks. The first successful parser wins.
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
  // K Sera Sarah's dated shows
  parseWithPattern(
    "K Sera Sarah possessive DJ name with date",
    /^(?<djName>K Ser(?:a|ah) Sarah)\s*'s (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, ?\d{4})$/,
  ),
  // trailing apostrophe before a hyphen divider
  // "Derek Monypeny' - Freedom Overspill Radio Hour #32, Sudanese 60s-70s, September 7, 2026"
  parseWithPattern(
    "trailing-apostrophe DJ name with date",
    /^(?<djName>[^-]+?)'\s*-\s*(?<title>.+),\s*(?<date>[A-Z][a-z]+ \d{1,2},\s?\d{4})$/,
  ),
  // hyphen divider and date comma with inconsistent spacing
  // "Derek Monypeny -Freedom Overspill Episode Eight, Terry Riley + Don Cherry, Unreleased, March 8, 2021"
  // "Derek Monypeny-Freedom Overspill Radio Hour Ep. 15, Devotional Music of Alice Coltrane, Sept 13,2021"
  parseWithPattern(
    "common comma date with flexible spacing",
    /^(?<djName>[^:]+?)\s*-\s*(?<title>.+),\s*(?<date>[A-Z][a-z]+ \d{1,2},\s?\d{4})$/,
  ),
  // colon divider
  // Justin Paszul: An Evening of Stand-Up Cosmogony, Hour #1, March 3, 2025
  parseWithPattern(
    "colon date",
    /^(?<djName>.+?): (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
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

  // broadcast date suffix
  // "Ethan and Caroline - 24 Hour Drone Live Set 2020, Broadcast on April 25, 2020"
  parseWithPattern(
    "broadcast date",
    /^(?<djName>.+?) - (?<title>.+), Broadcast on (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
  ),

  // trailing apostrophe in the DJ name without a parsed date
  // "Andrew Storrs' From the Vault 4 - Sounds from 6th and Market, 2012"
  parseWithPattern(
    "trailing-apostrophe DJ name without date",
    /^(?<djName>.+?)' (?<title>.+)$/,
  ),

  // hyphen divider with an apostrophe in the show title
  // "NATIONWIDEONYRSIDE - Live at Lander's Brew - Side B 2019"
  parseWithPattern(
    "hyphen without date with apostrophe in title",
    /^(?<djName>.+?) - (?<title>.+'.+)$/,
  ),

  // possessive DJ name without a date
  // "K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't"
  parseWithPattern(
    "possessive DJ name without date",
    /^(?!.*[A-Z][a-z]+ \d{1,2}, \d{4}$)(?<djName>.+?)'s (?<title>.+ - .+)$/,
  ),

  // colon divider without a date
  // "Peacetime Product: Episode 1 - Old Beginnings + New Endings"
  parseWithPattern(
    "colon without date",
    /^(?<djName>Peacetime Product): (?<title>.+)$/,
  ),

  // hypen divider, no date
  // Florina - ASEDR 6
  // NATIONWIDEONYRSIDE - Tight Joints Cousin - Side B 2019
  parseWithPattern("hyphen without date", /^(?<djName>.+?) - (?<title>.+)$/),
].map((parser, index) => ({ ...parser, index: index + 1 }));

/**
 * Parse a Mixcloud show name and report which parser recognized it.
 * A successful result may omit `date` when the caller must use Mixcloud's
 * creation timestamp as a fallback.
 */
const parseShowName = (name: string): ParseShowNameResult => {
  if (excludedShowNames.has(name)) {
    return { status: "failure", name };
  }

  // Try the ordered regular-expression parsers first.
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

  // "Pequeña Cretina Volume IV, November 27, 2023"
  // "Mellow and Normal Ep. 3, August 8, 2022"
  // "Temporal Emissions Episode 7: December 22, 2025"
  // Some recurring series use the DJ name as an unstructured prefix.
  for (const knownDJ of knownDJNames) {
    const escapedDJ = escapeRegExp(knownDJ);
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

/** Convert a parsed human-readable date to an ISO timestamp in UTC. */
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

  // Parse every imported cloudcast and retain parser metadata with each result.
  for (const entry of mixcloudCloudcasts.data) {
    const parsedShowName = parseShowName(entry.name);

    if (parsedShowName.status === "failure") {
      parseFailures.push(parsedShowName.name);
      continue;
    }

    const { djName, title, date } = parsedShowName.data;
    const manualDJOverride = manualDJOverrides.get(djName);
    const djNames =
      manualDJOverride === undefined
        ? [djName]
        : Array.isArray(manualDJOverride)
          ? manualDJOverride
          : [manualDJOverride];
    const { parser } = parsedShowName;
    const dateSource = date ? "parsed" : "fallback";
    const showDate = date ?? entry.created_time;
    const convertedDate = date
      ? convertDate(date)
      : new Date(entry.created_time).toISOString();

    console.log(
      `parsing "${entry.name}",\n | ${gray(`parser: ${parser.index} (${parser.name})`)}\n | dj_names: ${djNames.join(", ")}\n | title: ${title}\n | date: ${showDate}\n | converted_date: ${convertedDate}\n | date_source: ${dateSource}\n\n`,
    );

    collection.push({
      djNames,
      title,
      date: showDate,
      convertedDate,
      dateSource,
      parser,
    });

    // TODO: populate all fields of a show
    // TODO: coallate tags
  }

  // Print the normalized DJ/title listing before the aggregated DJ counts.
  console.log(
    collection
      .sort((e1, e2) =>
        e1.djNames.join(" + ").localeCompare(e2.djNames.join(" + ")),
      )
      .map((e) => `${e.djNames.join(" + ")} ---------------------- ${e.title}`)
      .join("\n"),
  );
  const djCounts = new Map<
    string,
    { count: number; parsers: Map<number, ParserMetadata> }
  >();
  for (const { djNames, parser } of collection) {
    for (const djName of djNames) {
      const existing = djCounts.get(djName) ?? {
        count: 0,
        parsers: new Map<number, ParserMetadata>(),
      };
      existing.count += 1;
      existing.parsers.set(parser.index, parser);
      djCounts.set(djName, existing);
    }
  }
  const maxDJNameLength = Math.max(
    0,
    ...Array.from(djCounts.keys(), (djName) => djName.length),
  );
  const maxDJCountLength = Math.max(
    1,
    ...Array.from(djCounts.values(), ({ count }) => String(count).length),
  );

  // Aggregate each DJ's count and the parser formats used for that DJ.
  console.log(
    [...djCounts]
      .sort(([firstName], [secondName]) => firstName.localeCompare(secondName))
      .map(
        ([djName, { count, parsers }]) =>
          `${djName.padEnd(maxDJNameLength)} | ${String(count).padStart(maxDJCountLength)} | ${gray(
            [...parsers.values()]
              .sort((first, second) => first.index - second.index)
              .map(({ index, name }) => `${index} (${name})`)
              .join(", "),
          )}`,
      )
      .join("\n"),
  );

  for (const name of parseFailures) {
    console.error(red(`Failed to parse show name: "${name}"`));
  }

  // Explain which parsers produced records whose dates needed a fallback.
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
