import { parseTrackTime } from "../../tracklist-editor-modal/index.js";

/** Duration uses tracklist clock syntax but must fit a positive database integer. */
export const parseShowDuration = (value: string): number => {
	const seconds = parseTrackTime(value);
	if (seconds === null || seconds < 1 || seconds > 2_147_483_647)
		throw new Error("Duration must be between 0:01 and 596523:14:07.");
	return seconds;
};
