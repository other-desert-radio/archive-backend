export type ValidateTagsResult = {
	valid: string[];
	invalid: string[];
};

/**
 * Validates submitted tag titles against the authenticated admin API.
 *
 * @param tags - Trimmed or raw tag titles to validate.
 * @param fetcher - Fetch implementation, injectable for focused tests.
 * @returns The submitted titles split into existing and missing tags.
 * @throws When the validation endpoint returns an unsuccessful response.
 */
export const validateTags = async (
	tags: string[],
	fetcher: typeof fetch = fetch,
): Promise<ValidateTagsResult> => {
	const response = await fetcher("/api/admin/validate-tags", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ tags }),
	});

	if (!response.ok) {
		throw new Error("Unable to validate tags");
	}

	return (await response.json()) as ValidateTagsResult;
};
