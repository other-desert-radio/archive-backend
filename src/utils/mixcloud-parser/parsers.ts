import type { ParserFnResult, ShowTitleParser } from "./types.js";

const parseWithPattern = ({
	pattern,
	key,
}: {
	pattern: RegExp;
	key: string;
}): ShowTitleParser => ({
	key,
	parse: (value) => {
		const match = pattern.exec(value);
		return match?.groups as ParserFnResult | undefined;
	},
});

const knownDJNames = [
	"Pequeña Cretina",
	"Temporal Emissions",
	"Mellow and Normal",
	"Dev.01d",
];

/** Escape a literal DJ name before embedding it in a dynamic regular expression. */
const escapeRegExp = (value: string): string =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// trailing-apostrophe DJ name with month and year
// "Andrew Storrs' From the Vault 5 - Terry Allen LIVE @ Zebulon LA, February 2020"
const trailingApostropheDJNameWithMonthAndYearParser = parseWithPattern({
	key: "trailing-apostrophe-dj-name-with-month-and-year",
	pattern: /^(?<djName>.+?)' (?<title>.+), (?<date>[A-Z][a-z]+ \d{4})$/,
});

// possessive DJ name
// "Ethan Primason's Yugoslav Special - August 10, 2020"
// "K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't",
// Drop the possessive suffix and use the remaining text as the show title.
const possessiveDJNameWithDateParser = parseWithPattern({
	key: "possessive-dj-name-with-date",
	pattern:
		/^(?<djName>.+?)'s (?<title>.+) - (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
});
// K Sera Sarah's dated shows
const kSeraSarahPossessiveDJNameWithDateParser = parseWithPattern({
	key: "k-sera-sarah-possessive-dj-name-with-date",
	pattern:
		/^(?<djName>K Ser(?:a|ah) Sarah)\s*'s (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, ?\d{4})$/,
});
// trailing apostrophe before a hyphen divider
// "Derek Monypeny' - Freedom Overspill Radio Hour #32, Sudanese 60s-70s, September 7, 2026"
const trailingApostropheDJNameWithDateParser = parseWithPattern({
	key: "trailing-apostrophe-dj-name-with-date",
	pattern:
		/^(?<djName>[^-]+?)'\s*-\s*(?<title>.+),\s*(?<date>[A-Z][a-z]+ \d{1,2},\s?\d{4})$/,
});
// hyphen divider and date comma with inconsistent spacing
// "Derek Monypeny -Freedom Overspill Episode Eight, Terry Riley + Don Cherry, Unreleased, March 8, 2021"
// "Derek Monypeny-Freedom Overspill Radio Hour Ep. 15, Devotional Music of Alice Coltrane, Sept 13,2021"
const commonCommaDateWithFlexibleSpacingParser = parseWithPattern({
	key: "common-comma-date-with-flexible-spacing",
	pattern:
		/^(?<djName>[^:]+?)\s*-\s*(?<title>.+),\s*(?<date>[A-Z][a-z]+ \d{1,2},\s?\d{4})$/,
});
// colon divider
// Justin Paszul: An Evening of Stand-Up Cosmogony, Hour #1, March 3, 2025
const colonDateParser = parseWithPattern({
	key: "colon-date",
	pattern:
		/^(?<djName>.+?): (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
});
// The common case
// "Ethan - Side A, April 6, 2020"
const commonCommaDateParser = parseWithPattern({
	key: "common-comma-date",
	pattern:
		/^(?<djName>.+?) - (?<title>.+), (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
});

// hyphen divider
// "Caroline - Mojave Window Optics pt. 2 - June 1, 2020"
const hyphenDateParser = parseWithPattern({
	key: "hyphen-date",
	pattern:
		/^(?<djName>.+?) - (?<title>.+) - (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
});

// broadcast date suffix
// "Ethan and Caroline - 24 Hour Drone Live Set 2020, Broadcast on April 25, 2020"
const broadcastDateParser = parseWithPattern({
	key: "broadcast-date",
	pattern:
		/^(?<djName>.+?) - (?<title>.+), Broadcast on (?<date>[A-Z][a-z]+ \d{1,2}, \d{4})$/,
});

// trailing apostrophe in the DJ name without a parsed date
// "Andrew Storrs' From the Vault 4 - Sounds from 6th and Market, 2012"
const trailingApostropheDJNameWithoutDateParser = parseWithPattern({
	key: "trailing-apostrophe-dj-name-without-date",
	pattern: /^(?<djName>.+?)' (?<title>.+)$/,
});

// hyphen divider with an apostrophe in the show title
// "NATIONWIDEONYRSIDE - Live at Lander's Brew - Side B 2019"
const hyphenWithoutDateWithApostropheInTitleParser = parseWithPattern({
	key: "hyphen-without-date-with-apostrophe-in-title",
	pattern: /^(?<djName>.+?) - (?<title>.+'.+)$/,
});

// possessive DJ name without a date
// "K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't"
const possessiveDJNameWithoutDateParser = parseWithPattern({
	key: "possessive-dj-name-without-date",
	pattern:
		/^(?!.*[A-Z][a-z]+ \d{1,2}, \d{4}$)(?<djName>.+?)'s (?<title>.+ - .+)$/,
});

// colon divider without a date
// "Peacetime Product: Episode 1 - Old Beginnings + New Endings"
const colonWithoutDateParser = parseWithPattern({
	key: "colon-without-date",
	pattern: /^(?<djName>Peacetime Product): (?<title>.+)$/,
});

// hypen divider, no date
// Florina - ASEDR 6
// NATIONWIDEONYRSIDE - Tight Joints Cousin - Side B 2019
const hyphenWithoutDateParser = parseWithPattern({
	key: "hyphen-without-date",
	pattern: /^(?<djName>.+?) - (?<title>.+)$/,
});

// "Pequeña Cretina Volume IV, November 27, 2023"
// "Mellow and Normal Ep. 3, August 8, 2022"
// "Temporal Emissions Episode 7: December 22, 2025"
// Some recurring series use the DJ name as an unstructured prefix.
const knownDJNameParser: ShowTitleParser = {
	key: "known-dj-name",
	parse: (name) => {
		for (const knownDJ of knownDJNames) {
			const escapedDJ = escapeRegExp(knownDJ);
			const knownDJPattern = new RegExp(
				`^(?<djName>${escapedDJ})(?:\\s*-\\s*|\\s+)(?<title>.+?)[,:] (?<date>[A-Z][a-z]+ \\d{1,2}, \\d{4})$`,
			);
			const data = parseWithPattern({
				key: "known-dj-name",
				pattern: knownDJPattern,
			}).parse(name);
			if (data !== undefined) return data;
		}
		return undefined;
	},
};

// Keep specific parsers above broad fallbacks. The first successful parser wins.
export const parsers: Array<ShowTitleParser> = [
	trailingApostropheDJNameWithMonthAndYearParser,
	possessiveDJNameWithDateParser,
	kSeraSarahPossessiveDJNameWithDateParser,
	trailingApostropheDJNameWithDateParser,
	commonCommaDateWithFlexibleSpacingParser,
	colonDateParser,
	commonCommaDateParser,
	hyphenDateParser,
	broadcastDateParser,
	trailingApostropheDJNameWithoutDateParser,
	hyphenWithoutDateWithApostropheInTitleParser,
	possessiveDJNameWithoutDateParser,
	colonWithoutDateParser,
	hyphenWithoutDateParser,
	knownDJNameParser,
];
