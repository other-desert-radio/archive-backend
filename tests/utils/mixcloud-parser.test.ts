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
	expect(MIXCLOUD_PARSER_VERSION).toBe(0);
	expect(parseMixcloudEntry(entry)).toEqual({
		key: entry.key,
		derived_title: "Side A",
		derived_date: null,
		decoded_djs: ["Ethan"],
		parser_version: MIXCLOUD_PARSER_VERSION,
		parser_key: "common-comma-date-with-flexible-spacing",
		date_source: null,
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
