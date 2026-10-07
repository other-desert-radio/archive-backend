import { isMatching, P } from "ts-pattern";
import type { CreateShowRequest } from "../../../../../admin/routes/shows/index.js";
import { isHttpUrl, splitCommaSeparated } from "../../../../../utils/index.js";

export type CreateShowForm = CreateShowRequest;

export const buildCreateShowRequest = (fields: {
	title: string;
	date: string;
	duration: string;
	image_small: string;
	image_large: string;
	tags: string;
	url: string;
	djs: number[];
}): CreateShowForm => {
	const duration = Number(fields.duration);
	if (!isMatching(P.number.int().between(1, 2_147_483_647), duration))
		throw new Error("Duration must be a positive whole number of seconds.");
	const image_small = fields.image_small.trim();
	const image_large = fields.image_large.trim();
	for (const [label, value] of [
		["Small", image_small],
		["Large", image_large],
	] as const) {
		if (!isHttpUrl(value))
			throw new Error(`${label} image must be an absolute HTTP(S) URL.`);
	}
	const tags = splitCommaSeparated(fields.tags);
	return {
		title: fields.title.trim(),
		date: fields.date,
		duration,
		url: fields.url.trim(),
		djs: fields.djs,
		image_small,
		image_large,
		...(tags.length === 0 ? {} : { tags }),
	};
};
