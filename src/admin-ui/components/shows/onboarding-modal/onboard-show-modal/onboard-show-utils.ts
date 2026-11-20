import type { CreateShowRequest } from "../../../../../admin/routes/shows/index.js";
import type { ShowTracklistEntry } from "../../../../../db/types.js";
import { isHttpUrl, splitCommaSeparated } from "../../../../../utils/index.js";

import { parseShowDuration } from "../show-duration-field/index.js";

export type CreateShowForm = CreateShowRequest & {
	tracklist?: ShowTracklistEntry[];
};

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
	special_id?: number | null;
}): CreateShowForm => {
	if ((fields.description?.length ?? 0) > 1000)
		throw new Error("Description must be at most 1000 characters.");
	const duration = parseShowDuration(fields.duration);
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
		...(fields.special_id === undefined
			? {}
			: { special_id: fields.special_id }),
		mixcloud_image_small,
		mixcloud_image_large,
		...(tags.length === 0 ? {} : { tags }),
	};
};
