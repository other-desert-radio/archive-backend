import type { CreateDJRequest } from "../../admin/routes/djs/types.js";
import { splitCommaSeparated } from "../../utils/index.js";

export type OnboardDJFieldValues = {
	title: string;
	image: string;
	tags: string;
	socials: string;
	bio: string;
};

/**
 * Builds the typed DJ creation payload from the modal's text fields.
 *
 * Optional text fields and tags are omitted when empty. Comma-separated tags
 * are trimmed and empty entries are removed.
 *
 * @param fields - Raw controlled values from the onboarding modal.
 * @returns A request payload matching `CreateDJRequest`.
 */
export const buildCreateDJRequest = (
	fields: OnboardDJFieldValues,
): CreateDJRequest => {
	const image = fields.image.trim();
	const socials = fields.socials.trim();
	const tags = splitCommaSeparated(fields.tags);

	return {
		title: fields.title.trim(),
		bio: fields.bio.trim(),
		...(image === "" ? {} : { image }),
		...(socials === "" ? {} : { socials }),
		...(tags.length === 0 ? {} : { tags }),
	};
};
