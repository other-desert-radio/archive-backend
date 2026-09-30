import { isMatching } from "ts-pattern";
import {
	type ModifyTagRequest,
	ModifyTagRequestPattern,
} from "../../../../../admin/routes/tags/index.js";

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
	if (request.mixcloud_url !== "") {
		let valid = false;
		try {
			const url = new URL(request.mixcloud_url);
			valid = url.protocol === "http:" || url.protocol === "https:";
		} catch {
			/* Invalid absolute URL. */
		}
		if (!valid)
			throw new Error("Mixcloud URL must be an absolute HTTP(S) URL.");
	}
	return request;
};

export const buildModifyTagRequest = (
	id: number,
	fields: TagFormValues,
): ModifyTagRequest => {
	const request = { id, ...buildTagFields(fields) };
	if (!isMatching(ModifyTagRequestPattern, request))
		throw new Error("Invalid Tag fields.");
	return request;
};
