import { undefinedOrEmpty } from "../../../utils/index.js";
import type { CreateDJRequest } from "./types.js";

export type NormalizedCreateDJRequest = {
	title: string;
	image: string | null;
	tags: string[];
	socials: string | null;
	showTitle: string | null;
	showDescription: string | null;
	bio: string;
};

/**
 * Normalizes a structurally valid DJ creation request for persistence.
 *
 * Required text is trimmed, blank optional text is represented as `null`, and
 * empty tag entries are removed. Duplicate tags are preserved for later
 * resolution.
 *
 * @param request - A request that has already passed pattern validation.
 * @returns The normalized request fields ready for persistence.
 */
export const normalizeCreateDJRequest = (
	request: CreateDJRequest,
): NormalizedCreateDJRequest => {
	const image = request.image?.trim();
	const socials = request.socials?.trim();
	const showTitle = request.showTitle?.trim();
	const showDescription = request.showDescription?.trim();

	return {
		title: request.title.trim(),
		image: undefinedOrEmpty(image) ? null : image,
		tags:
			request.tags?.map((tag) => tag.trim()).filter((tag) => tag !== "") ?? [],
		socials: undefinedOrEmpty(socials) ? null : socials,
		showTitle: undefinedOrEmpty(showTitle) ? null : showTitle,
		showDescription: undefinedOrEmpty(showDescription) ? null : showDescription,
		bio: request.bio.trim(),
	};
};
