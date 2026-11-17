import type { ShowTracklistEntry } from "../db/types.js";

/** Validates JSON entries before they reach the database constraint. */
export const isShowTracklistEntry = (
	value: unknown,
): value is ShowTracklistEntry => {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as Record<string, unknown>;
	const nonblank = (text: unknown) =>
		typeof text === "string" && text.trim() !== "";
	const validTime =
		entry.start_time === null ||
		(typeof entry.start_time === "number" &&
			Number.isSafeInteger(entry.start_time) &&
			entry.start_time >= 0);
	return (
		validTime &&
		("chapter" in entry
			? nonblank(entry.chapter) && !("artist" in entry) && !("song" in entry)
			: nonblank(entry.artist) && nonblank(entry.song))
	);
};
