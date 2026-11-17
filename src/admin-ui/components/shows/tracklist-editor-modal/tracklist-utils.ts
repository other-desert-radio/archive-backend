import type { ShowTracklistEntry } from "../../../../db/types.js";

export const formatTrackTime = (seconds: number | null): string => {
	if (seconds === null) return "";
	const minutes = Math.floor(seconds / 60);
	const remainder = String(seconds % 60).padStart(2, "0");
	return minutes < 60
		? `${minutes}:${remainder}`
		: `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${remainder}`;
};

/** Blank is unknown; the leading clock segment may exceed two digits. */
export const parseTrackTime = (input: string): number | null => {
	const value = input.trim();
	if (value === "") return null;
	if (!/^\d+:[0-5]\d$|^\d+:[0-5]\d:[0-5]\d$/.test(value))
		throw new Error(
			"Timestamp must use m:ss or h:mm:ss, e.g. 3:07 or 1:03:07.",
		);
	const seconds = value
		.split(":")
		.reduce((total, part) => total * 60 + Number(part), 0);
	if (!Number.isSafeInteger(seconds))
		throw new Error("Timestamp is too large.");
	return seconds;
};

export const formatTracklist = (entries: ShowTracklistEntry[]): string =>
	entries
		.map(
			(entry, index) =>
				`${index + 1} | ${[
					...(entry.chapter !== undefined
						? [entry.chapter]
						: [entry.song, entry.artist]),
					...(entry.start_time === null
						? []
						: [formatTrackTime(entry.start_time)]),
				].join(", ")}`,
		)
		.join("\n");
