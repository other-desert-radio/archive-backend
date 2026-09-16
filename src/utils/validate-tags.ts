type ValidateTagsParams = {
	incomingTags: string[];
	existingTags: string[];
};

type ValidateTagsResult = {
	valid: string[];
	invalid: string[];
};

export const validateTags = async (
	params: ValidateTagsParams,
): Promise<ValidateTagsResult> => {
	const existing = new Set(
		params.existingTags.map((tag) => tag.trim().toLowerCase()),
	);
	const valid: string[] = [];
	const invalid: string[] = [];

	for (const tag of params.incomingTags) {
		const title = tag.trim();

		if (existing.has(title.toLowerCase())) {
			valid.push(title);
		} else {
			invalid.push(title);
		}
	}

	return { valid, invalid };
};
