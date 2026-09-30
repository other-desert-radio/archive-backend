import type { CreateTagRequest } from "../../../../../admin/routes/tags/index.js";
import {
	buildTagFields,
	type TagFormValues,
} from "../edit-tag-modal/edit-tag-utils.js";

export const buildCreateTagRequest = (
	fields: TagFormValues,
): CreateTagRequest => {
	const { title, color, mixcloud_key, mixcloud_url } = buildTagFields(
		1,
		fields,
	);
	return {
		title,
		color,
		...(mixcloud_key ? { mixcloud_key } : {}),
		...(mixcloud_url ? { mixcloud_url } : {}),
	};
};
