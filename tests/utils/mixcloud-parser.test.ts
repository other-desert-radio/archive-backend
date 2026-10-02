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
		parser_key: "common-comma-date",
		date_source: null,
	});
	expect(entry).toEqual(before);
});

test("unmatched titles return empty suggestions with the current parser version", () => {
	expect(
		parseMixcloudEntry({
			key: "/unmatched/",
			name: "Unstructured show",
			created_time: "2020-04-07T12:00:00Z",
		}),
	).toEqual({
		key: "/unmatched/",
		derived_title: null,
		derived_date: null,
		decoded_djs: null,
		parser_version: MIXCLOUD_PARSER_VERSION,
		parser_key: null,
		date_source: null,
	});
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
				.parser_key,
		).toBe("common-comma-date");
		expect(laterParser.parse).not.toHaveBeenCalled();
	} finally {
		parsers.splice(originalLength);
	}
});
