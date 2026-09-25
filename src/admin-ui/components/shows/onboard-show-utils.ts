import { splitCommaSeparated } from "../../../utils/index.js";

export type CreateShowForm = {
	title: string;
	date: string;
	duration: number;
	url: string;
	djs: number[];
	image?: string;
	tags?: string[];
};

export const buildCreateShowRequest = (fields: {
	title: string;
	date: string;
	hours: string;
	minutes: string;
	seconds: string;
	image: string;
	tags: string;
	url: string;
	djs: number[];
}): CreateShowForm => {
	const hours = Number(fields.hours || "0");
	const minutes = Number(fields.minutes || "0");
	const seconds = Number(fields.seconds || "0");
	if (
		!Number.isInteger(hours) ||
		hours < 0 ||
		!Number.isInteger(minutes) ||
		minutes < 0 ||
		minutes > 59 ||
		!Number.isInteger(seconds) ||
		seconds < 0 ||
		seconds > 59
	)
		throw new Error(
			"Duration must use nonnegative hours and minutes/seconds from 0 to 59.",
		);
	const duration = hours * 3600 + minutes * 60 + seconds;
	if (duration < 1) throw new Error("Duration must be positive.");
	const image = fields.image.trim();
	const tags = splitCommaSeparated(fields.tags);
	return {
		title: fields.title.trim(),
		date: fields.date,
		duration,
		url: fields.url.trim(),
		djs: fields.djs,
		...(image === "" ? {} : { image }),
		...(tags.length === 0 ? {} : { tags }),
	};
};
