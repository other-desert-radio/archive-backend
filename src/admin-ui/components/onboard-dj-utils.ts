import { splitCommaSeparated } from "../../utils/index.js";

export type CreateDJForm = {
	title: string;
	bio: string;
	tags?: string[];
	socials?: string;
	image?: File;
};

export type OnboardDJFieldValues = {
	title: string;
	image?: File;
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
): CreateDJForm => {
	const socials = fields.socials.trim();
	const tags = splitCommaSeparated(fields.tags);

	return {
		title: fields.title.trim(),
		bio: fields.bio.trim(),
		...(socials === "" ? {} : { socials }),
		...(tags.length === 0 ? {} : { tags }),
		...(fields.image === undefined ? {} : { image: fields.image }),
	};
};
