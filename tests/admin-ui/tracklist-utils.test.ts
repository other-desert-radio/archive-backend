import { expect, test } from "bun:test";
import {
	formatTracklist,
	formatTrackTime,
	parseTrackTime,
} from "../../src/admin-ui/components/shows/tracklist-editor-modal/tracklist-utils.js";

test("clock times round trip, including unknown, zero, hours and long minutes", () => {
	for (const [input, seconds, output] of [
		["", null, ""],
		["  ", null, ""],
		["0:00", 0, "0:00"],
		["3:07", 187, "3:07"],
		["1:03:07", 3787, "1:03:07"],
		[" 63:07 ", 3787, "1:03:07"],
		["123:00:00", 442800, "123:00:00"],
	] as const) {
		expect(parseTrackTime(input)).toBe(seconds);
		expect(formatTrackTime(seconds)).toBe(output);
	}
});

test("rejects malformed clocks and unsafe second values", () => {
	for (const input of [
		"187",
		"-1:00",
		"3:7",
		"1:60",
		"1:60:00",
		"1:00:60",
		"1:00.5",
		"x:00",
		"1:00:00:00",
		"9999999999999999:00",
	])
		expect(() => parseTrackTime(input)).toThrow();
});

test("preview numbers rows in order and renders song before artist as literal text", () => {
	expect(
		formatTracklist([
			{ chapter: "Intro", start_time: 0 },
			{ artist: "<Artist>", song: "Song", start_time: null },
			{ chapter: "Interview", start_time: 3787 },
		]),
	).toBe("1 | Intro, 0:00\n2 | Song, <Artist>\n3 | Interview, 1:03:07");
	expect(formatTracklist([])).toBe("");
});
