import { isMatching, P } from "ts-pattern";
import { isHttpUrl } from "../../../utils/index.js";
import type { CreateShowRequest } from "./types.js";

export type NormalizedCreateShowRequest = {
	title: string;
	date: Date;
	duration: number;
	url: string;
	djs: number[];
	image_small: string;
	image_large: string;
	tags: string[];
};

const parseCalendarDate = (value: string): Date | undefined => {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (match === null) return undefined;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
		? date
		: undefined;
};

/** Normalizes and semantically validates editable Show fields for creation or replacement. */
export const normalizeCreateShowRequest = (
	request: CreateShowRequest,
): NormalizedCreateShowRequest => {
	const title = request.title.trim();
	const date = parseCalendarDate(request.date);
	const url = request.url.trim();
	const image_small = request.image_small.trim();
	const image_large = request.image_large.trim();
	const djs = [...new Set(request.djs)];
	const tags = request.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [];
	if (
		!isMatching({ title: P.string.minLength(1) }, { title }) ||
		date === undefined ||
		!Number.isInteger(request.duration) ||
		request.duration < 1 ||
		request.duration > 2_147_483_647 ||
		!isHttpUrl(url) ||
		djs.length === 0 ||
		djs.some((id) => !Number.isSafeInteger(id) || id < 1) ||
		!isHttpUrl(image_small) ||
		!isHttpUrl(image_large)
	) {
		throw new Error("Validation error");
	}
	return {
		title,
		date,
		duration: request.duration,
		url,
		djs,
		image_small,
		image_large,
		tags,
	};
};
