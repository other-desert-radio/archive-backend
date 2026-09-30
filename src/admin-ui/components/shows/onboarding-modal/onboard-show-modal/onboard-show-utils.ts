import { isMatching, P } from "ts-pattern";
import type { CreateShowRequest } from "../../../../../admin/routes/shows/index.js";
import { splitCommaSeparated } from "../../../../../utils/index.js";

export type CreateShowForm = CreateShowRequest;

export const buildCreateShowRequest = (fields: {
	title: string;
	date: string;
	duration: string;
	image: string;
	tags: string;
	url: string;
	djs: number[];
}): CreateShowForm => {
	const duration = Number(fields.duration);
	if (!isMatching(P.number.int().between(1, 2_147_483_647), duration))
		throw new Error("Duration must be a positive whole number of seconds.");
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
