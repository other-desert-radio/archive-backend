import type { MixcloudCloudcasts } from "../admin/routes/mixcloud-imports/types.js";
import mixcloudCloudcastsJson from "../res/mixcloud.json" with { type: "json" };
import {
	type MixcloudParserResult,
	parseMixcloudEntry,
} from "../utils/index.js";

export const mixcloudCloudcasts: MixcloudCloudcasts = mixcloudCloudcastsJson;

/** Format an application error message in red terminal text. */
const red = (text: string): string => `\u001b[31m${text}\u001b[0m`;

/** Format parser diagnostics in gray terminal text. */
const gray = (text: string): string => `\u001b[90m${text}\u001b[0m`;

type ParsedShow = MixcloudParserResult & {
	djNames: string[];
	image: string | undefined;
	duration: number;
	url: string;
	tags: string[];
};

// Keep these diagnostic-only overrides until shared DJ normalization is added.
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
		["Hans F. Wagner", "Jon Nielson"],
	],
]);

if (import.meta.main) {
	console.log(`Loaded ${mixcloudCloudcasts.data.length} Mixcloud shows.`);

	const collection: ParsedShow[] = [];
	const parseFailures: string[] = [];

	for (const entry of mixcloudCloudcasts.data) {
		const parsed = parseMixcloudEntry(entry);
		if (parsed === undefined) {
			parseFailures.push(entry.name);
			continue;
		}

		const djNames = (parsed.decoded_djs ?? []).flatMap((djName) => {
			const override = manualDJOverrides.get(djName);
			return override === undefined
				? [djName]
				: Array.isArray(override)
					? override
					: [override];
		});
		const date = parsed.derived_date?.toISOString() ?? "not extracted yet";
		console.log(
			`parsing "${entry.name}",\n | ${gray(`parser: ${parsed.parser_key} (version ${parsed.parser_version})`)}\n | key: ${parsed.key}\n | dj_names: ${djNames.join(", ")}\n | title: ${parsed.derived_title}\n | derived_date: ${date}\n | date_source: ${parsed.date_source ?? "not extracted yet"}\n | url: ${entry.url}\n | tags: ${entry.tags.map((tag) => tag.name).join(", ")}\n\n`,
		);
		collection.push({
			...parsed,
			djNames,
			image: entry.pictures.large,
			duration: entry.audio_length,
			url: entry.url,
			tags: entry.tags.map((tag) => tag.name),
		});
	}

	console.log(
		collection
			.sort((first, second) =>
				first.djNames.join(" + ").localeCompare(second.djNames.join(" + ")),
			)
			.map(
				(entry) =>
					`${entry.djNames.join(" + ")} ---------------------- ${entry.derived_title}`,
			)
			.join("\n"),
	);
	const djCounts = new Map<string, { count: number; parsers: Set<string> }>();
	for (const { djNames, parser_key } of collection) {
		for (const djName of djNames) {
			const existing = djCounts.get(djName) ?? {
				count: 0,
				parsers: new Set<string>(),
			};
			existing.count += 1;
			if (parser_key !== null) existing.parsers.add(parser_key);
			djCounts.set(djName, existing);
		}
	}
	const maxDJNameLength = Math.max(
		0,
		...Array.from(djCounts.keys(), (name) => name.length),
	);
	const maxDJCountLength = Math.max(
		1,
		...Array.from(djCounts.values(), ({ count }) => String(count).length),
	);
	console.log(
		[...djCounts]
			.sort(([first], [second]) => first.localeCompare(second))
			.map(
				([name, { count, parsers }]) =>
					`${name.padEnd(maxDJNameLength)} | ${String(count).padStart(maxDJCountLength)} | ${gray([...parsers].sort().join(", "))}`,
			)
			.join("\n"),
	);

	for (const name of parseFailures)
		console.error(red(`Failed to parse show name: "${name}"`));

	const missingDates = collection.filter(
		(entry) => entry.derived_date === null,
	);
	const missingDateParserCounts = new Map<string, number>();
	for (const entry of missingDates) {
		const key = entry.parser_key ?? "unknown";
		missingDateParserCounts.set(
			key,
			(missingDateParserCounts.get(key) ?? 0) + 1,
		);
	}
	for (const entry of collection.filter(
		(entry) =>
			entry.djNames.includes("Derek Monypeny") ||
			entry.djNames.includes("Muzizmu"),
	))
		console.log(entry);

	console.log(`\nsuccess count: ${collection.length}`);
	console.error(red(`failure count: ${parseFailures.length}`));
	console.error(
		red(
			`missing derived date count: ${missingDates.length}\n${[
				...missingDateParserCounts,
			]
				.sort(([first], [second]) => first.localeCompare(second))
				.map(([key, count]) => ` | parser ${key}: ${count}`)
				.join("\n")}`,
		),
	);
}
