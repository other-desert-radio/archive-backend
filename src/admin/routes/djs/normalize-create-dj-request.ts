import type { CreateDJRequest } from "./types.js";

export type NormalizedCreateDJRequest = {
	title: string;
	image?: string;
	tags: string[];
	socials?: string;
	bio: string;
};

/**
 * Normalizes a structurally valid DJ creation request for persistence.
 *
 * Required text is trimmed, blank optional text is omitted, and empty tag
 * entries are removed. Duplicate tags are preserved for later resolution.
 *
 * @param request - A request that has already passed pattern validation.
 * @returns The normalized request fields ready for persistence.
 */
export const normalizeCreateDJRequest = (
	request: CreateDJRequest,
): NormalizedCreateDJRequest => {
	const image = request.image?.trim();
	const socials = request.socials?.trim();

	return {
		title: request.title.trim(),
		...(image === undefined || image === "" ? {} : { image }),
		tags:
			request.tags?.map((tag) => tag.trim()).filter((tag) => tag !== "") ?? [],
		...(socials === undefined || socials === "" ? {} : { socials }),
		bio: request.bio.trim(),
	};
};
