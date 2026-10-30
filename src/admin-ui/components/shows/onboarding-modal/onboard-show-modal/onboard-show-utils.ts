import { isMatching, P } from "ts-pattern";
import type { CreateShowRequest } from "../../../../../admin/routes/shows/index.js";
import { isHttpUrl, splitCommaSeparated } from "../../../../../utils/index.js";

export type CreateShowForm = CreateShowRequest;

export const buildCreateShowRequest = (fields: {
	title: string;
	description?: string;
	date: string;
	duration: string;
	mixcloud_image_small: string;
	mixcloud_image_large: string;
	tags: string;
	url: string;
	djs: number[];
}): CreateShowForm => {
	if ((fields.description?.length ?? 0) > 1000)
		throw new Error("Description must be at most 1000 characters.");
	const duration = Number(fields.duration);
	if (!isMatching(P.number.int().between(1, 2_147_483_647), duration))
		throw new Error("Duration must be a positive whole number of seconds.");
	const mixcloud_image_small = fields.mixcloud_image_small.trim();
	const mixcloud_image_large = fields.mixcloud_image_large.trim();
	for (const [label, value] of [
		["Small", mixcloud_image_small],
		["Large", mixcloud_image_large],
	] as const) {
		if (!isHttpUrl(value))
			throw new Error(`${label} image must be an absolute HTTP(S) URL.`);
	}
	const tags = splitCommaSeparated(fields.tags);
	return {
		title: fields.title.trim(),
		...(fields.description === undefined
			? {}
			: { description: fields.description }),
		date: fields.date,
		duration,
		url: fields.url.trim(),
		djs: fields.djs,
		mixcloud_image_small,
		mixcloud_image_large,
		...(tags.length === 0 ? {} : { tags }),
	};
};
