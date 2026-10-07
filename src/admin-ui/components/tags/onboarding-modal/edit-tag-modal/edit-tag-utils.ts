import { isMatching } from "ts-pattern";
import {
	ModifyTagFullEditRequestPattern,
	type ModifyTagRequest,
} from "../../../../../admin/routes/tags/index.js";
import { isHttpUrl } from "../../../../../utils/index.js";

export type TagFormValues = {
	title: string;
	color: string;
	mixcloud_key: string;
	mixcloud_url: string;
};
export const isTagColor = (color: string) =>
	/^#[0-9a-fA-F]{6}$/.test(color.trim());

/** Validates the complete replacement request before sending it. */
export const buildTagFields = (fields: TagFormValues): TagFormValues => {
	const request = {
		title: fields.title.trim(),
		color: fields.color.trim(),
		mixcloud_key: fields.mixcloud_key.trim(),
		mixcloud_url: fields.mixcloud_url.trim(),
	};
	if (request.title === "") throw new Error("Title is required.");
	if (!isTagColor(request.color))
		throw new Error("Color must be a six-digit hex color (#RRGGBB).");
	if (request.mixcloud_url !== "" && !isHttpUrl(request.mixcloud_url))
		throw new Error("Mixcloud URL must be an absolute HTTP(S) URL.");

	return request;
};

export const buildModifyTagRequest = (
	id: number,
	fields: TagFormValues,
): ModifyTagRequest => {
	const request = {
		edit_type: "full_edit" as const,
		id,
		...buildTagFields(fields),
	};
	if (!isMatching(ModifyTagFullEditRequestPattern, request))
		throw new Error("Invalid Tag fields.");
	return request;
};
