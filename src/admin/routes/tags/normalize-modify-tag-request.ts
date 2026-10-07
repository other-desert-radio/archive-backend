import { isMatching, match, P } from "ts-pattern";
import { undefinedOrEmpty } from "../../../utils/index.js";
import type { ModifyTagRequest } from "./types.js";

export class TagEditValidationError extends Error {}

/** Matches the operation and normalizes only the columns it owns. */
export const normalizeModifyTagRequest = (request: ModifyTagRequest) =>
	match(request)
		.with({ edit_type: "review" }, ({ reviewed }) => ({
			edit_type: "review" as const,
			values: { reviewed },
		}))
		.with({ edit_type: "full_edit" }, (input) => ({
			edit_type: "full_edit" as const,
			values: normalizeMetadata(input),
		}))
		.with({ edit_type: "partial_edit" }, (input) => ({
			edit_type: "partial_edit" as const,
			values: normalizeMetadata(input),
		}))
		.exhaustive();

const normalizeMetadata = (
	input: Exclude<ModifyTagRequest, { edit_type: "review" }>,
) => {
	const title = input.title?.trim();
	const color = input.color?.trim();
	const key = input.mixcloud_key?.trim();
	const url = input.mixcloud_url?.trim();
	if (title !== undefined && !isMatching(P.string.minLength(1), title))
		throw new TagEditValidationError("Tag title is required");
	if (
		color !== undefined &&
		!isMatching(P.string.regex(/^#[0-9a-fA-F]{6}$/), color)
	)
		throw new TagEditValidationError(
			"Color must be a six-digit hex color (#RRGGBB)",
		);
	if (!undefinedOrEmpty(url)) {
		let valid = false;
		try {
			const parsed = new URL(url);
			valid = parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch {
			/* Invalid absolute URL. */
		}
		if (!valid)
			throw new TagEditValidationError(
				"Mixcloud URL must be an absolute HTTP(S) URL",
			);
	}
	if (
		input.edit_type === "partial_edit" &&
		[title, color, key, url].every((value) => value === undefined)
	)
		throw new TagEditValidationError("At least one editable field is required");
	return {
		reviewed: true,
		...(title === undefined ? {} : { title }),
		...(color === undefined ? {} : { color }),
		...(input.edit_type === "full_edit" || key !== undefined
			? { mixcloud_key: undefinedOrEmpty(key) ? null : key }
			: {}),
		...(input.edit_type === "full_edit" || url !== undefined
			? { mixcloud_url: undefinedOrEmpty(url) ? null : url }
			: {}),
	};
};
