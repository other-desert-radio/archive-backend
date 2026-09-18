/** Splits comma-separated text into trimmed, non-empty values. */
export const splitCommaSeparated = (value: string): string[] =>
	value
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item !== "");
