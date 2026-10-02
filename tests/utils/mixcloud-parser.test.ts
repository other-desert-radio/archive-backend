import { expect, mock, test } from "bun:test";
import {
	MIXCLOUD_PARSER_VERSION,
	parseMixcloudEntry,
	parsers,
} from "../../src/utils/index.js";

test("matching titles preserve source identity and return title/DJ suggestions", () => {
	const entry = Object.freeze({
		key: "/otherdesertradio/source-show/",
		name: "Ethan - Side A, April 6, 2020",
		created_time: "2020-04-07T12:00:00Z",
	});
	const before = { ...entry };
	expect(MIXCLOUD_PARSER_VERSION).toBe(1);
	expect(parseMixcloudEntry(entry)).toEqual({
		key: entry.key,
		derived_title: "Side A",
		derived_date: new Date("2020-04-06T00:00:00Z"),
		decoded_djs: ["Ethan"],
		parser_version: MIXCLOUD_PARSER_VERSION,
		parser_key: "common-comma-date-with-flexible-spacing",
		date_source: "title",
	});
	expect(entry).toEqual(before);
});

test("unmatched titles return undefined", () => {
	expect(
		parseMixcloudEntry({
			key: "/unmatched/",
			name: "Unstructured show",
			created_time: "2020-04-07T12:00:00Z",
		}),
	).toBeUndefined();
});

test("tries subsequent matchers after a miss and stops at the first match", () => {
	const laterParser = {
		key: "test-fallback",
		parse: mock(() => ({ title: "Fallback title", djName: "Fallback DJ" })),
	};
	const lastParser = {
		key: "test-last",
		parse: mock(() => ({ title: "Last title", djName: "Last DJ" })),
	};
	const originalLength = parsers.length;
	parsers.push(laterParser, lastParser);
	try {
		const entry = {
			key: "/source/",
			name: "Unstructured show",
			created_time: "2020-04-07T12:00:00Z",
		};
		expect(parseMixcloudEntry(entry)).toMatchObject({
			derived_title: "Fallback title",
			decoded_djs: ["Fallback DJ"],
			parser_key: "test-fallback",
		});
		expect(laterParser.parse).toHaveBeenCalledWith(entry.name);
		expect(lastParser.parse).not.toHaveBeenCalled();
		laterParser.parse.mockClear();
		expect(
			parseMixcloudEntry({ ...entry, name: "Ethan - Side A, April 6, 2020" })
				?.parser_key,
		).toBe("common-comma-date-with-flexible-spacing");
		expect(laterParser.parse).not.toHaveBeenCalled();
	} finally {
		parsers.splice(originalLength);
	}
});

test("excluded titles remain unparsed even when a broad matcher would recognize them", () => {
	for (const name of [
		"K Sera Sarah's Beyond Karaoke Episode 12 - Free Will or Free Won't",
		"Looking Glass with Lodi Dottie Episode 7, August 3, 2026",
	]) {
		expect(
			parseMixcloudEntry({
				key: "/excluded/",
				name,
				created_time: "2026-09-01T00:00:00Z",
			}),
		).toBeUndefined();
	}
});

test("specific apostrophe and date matchers win over broad fallbacks", () => {
	expect(
		parseMixcloudEntry({
			key: "/specific/",
			name: "Andrew Storrs' From the Vault 5, February 2020",
			created_time: "2020-03-01T00:00:00Z",
		}),
	).toMatchObject({
		derived_title: "From the Vault 5",
		decoded_djs: ["Andrew Storrs"],
		parser_key: "trailing-apostrophe-dj-name-with-month-and-year",
	});
	expect(
		parseMixcloudEntry({
			key: "/known/",
			name: "Temporal Emissions Episode 7: December 22, 2025",
			created_time: "2026-01-01T00:00:00Z",
		}),
	).toMatchObject({
		derived_title: "Episode 7",
		decoded_djs: ["Temporal Emissions"],
		parser_key: "known-dj-name",
	});
});

for (const [djName, expected] of [
	["Tara Jane O'Neil (TJO)", ["Tara Jane O'Neil"]],
	["K Serah Sarah", ["K Sera Sarah"]],
	["Caroline + Ethan", ["Caroline", "Ethan"]],
	["Ethan and Caroline", ["Caroline", "Ethan"]],
	["Lodi Dottie X Muzizmu", ["Lodi Dottie", "Muzizmu"]],
	["  Caroline and Ethan  ", ["Caroline", "Ethan"]],
	["Mellow and Normal", ["Mellow and Normal"]],
	["Unknown + Collaborator", ["Unknown + Collaborator"]],
	["   ", []],
] as const) {
	test(`normalizes DJ names for ${JSON.stringify(djName)}`, () => {
		const entry = {
			key: "/normalization/",
			name: `${djName} - Test show`,
			created_time: "2026-01-01T00:00:00Z",
		};
		expect(parseMixcloudEntry(entry)?.decoded_djs).toEqual([...expected]);
	});
}

test("returned DJ names do not mutate shared override arrays", () => {
	const entry = {
		key: "/normalization/",
		name: "Caroline and Ethan - Test show",
		created_time: "2026-01-01T00:00:00Z",
	};
	parseMixcloudEntry(entry)?.decoded_djs?.push("Changed");
	expect(parseMixcloudEntry(entry)?.decoded_djs).toEqual(["Caroline", "Ethan"]);
});

for (const [name, createdTime, expected, source] of [
	["Ethan - Show, February 29, 2024", "invalid", "2024-02-29", "title"],
	[
		"Ethan - Show, February 29, 2023",
		"2023-03-02T23:59:59Z",
		"2023-03-02",
		"created_time",
	],
	[
		"Ethan - Show, April 31, 2020",
		"2020-05-02T12:00:00Z",
		"2020-05-02",
		"created_time",
	],
	[
		"Ethan - Show, April 0, 2020",
		"2020-05-02T12:00:00Z",
		"2020-05-02",
		"created_time",
	],
	[
		"Ethan - Show, Fake 6, 2020",
		"2020-05-02T12:00:00Z",
		"2020-05-02",
		"created_time",
	],
	["Ethan - Show, Sept 13,2021", "invalid", "2021-09-13", "title"],
	["Andrew Storrs' Show, February 2020", "invalid", "2020-02-01", "title"],
	["Ethan - Show", "2020-04-07T23:30:00-02:00", "2020-04-08", "created_time"],
	[
		"Ethan - Show",
		"2020-04-07T01:30:00.123+02:00",
		"2020-04-06",
		"created_time",
	],
	["Ethan - Show", "invalid", null, null],
	["Ethan - Show", "2023-02-29T12:00:00Z", null, null],
	["Ethan - Show", "2020-04-07T24:00:00Z", null, null],
	["Ethan - Show", "2020-04-07", null, null],
	["Ethan - Show, February 30, 2020", "invalid", null, null],
] as const) {
	test(`extracts date for ${name} with ${createdTime}`, () => {
		const result = parseMixcloudEntry({
			key: "/date/",
			name,
			created_time: createdTime,
		});
		expect(result).toBeDefined();
		expect(result?.derived_date?.toISOString() ?? null).toBe(
			expected ? `${expected}T00:00:00.000Z` : null,
		);
		expect(result?.date_source).toBe(source);
	});
}
