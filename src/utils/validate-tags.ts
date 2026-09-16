import type { TypedDatabase } from "../admin/admin.js";

type ValidateTagsParams = {
	tags: string[];
	database: TypedDatabase;
};

type ValidateTagsResult = {
	valid: string[];
	invalid: string[];
};

export const validateTags = async (
	params: ValidateTagsParams,
): Promise<ValidateTagsResult> => {
	const tags = await params.database
		.selectFrom("tags")
		.select("title")
		.execute();

	const existing = new Set(tags.map((tag) => tag.title.toLowerCase()));
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const tag of params.tags) {
		const title = tag.trim();

		if (existing.has(title.toLowerCase())) {
			valid.push(title);
		} else {
			invalid.push(title);
		}
	}

	return { valid, invalid };
};
