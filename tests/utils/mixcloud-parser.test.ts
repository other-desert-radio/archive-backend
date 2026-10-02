import { expect, test } from "bun:test";
import {
	MIXCLOUD_PARSER_VERSION,
	parseMixcloudEntry,
} from "../../src/utils/index.js";

test("parser scaffold preserves source identity and returns empty version-zero suggestions", () => {
	const entry = Object.freeze({
		key: "/otherdesertradio/source-show/",
		name: "Ethan - Side A, April 6, 2020",
		created_time: "2020-04-07T12:00:00Z",
	});
	const before = { ...entry };
	expect(MIXCLOUD_PARSER_VERSION).toBe(0);
	expect(parseMixcloudEntry(entry)).toEqual({
		key: entry.key,
		derived_title: null,
		derived_date: null,
		decoded_djs: null,
		parser_version: MIXCLOUD_PARSER_VERSION,
		parser_key: null,
		date_source: null,
	});
	expect(entry).toEqual(before);
});
