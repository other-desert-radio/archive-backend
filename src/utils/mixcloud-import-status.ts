/** Fields shared by database rows and the admin JSON contract. */
type ImportSuggestions = {
	show_id?: number | null;
	derived_title?: string | null;
	derived_date?: Date | string | null;
	decoded_djs?: string[] | null;
	parser_version?: number | null;
	parser_key?: string | null;
	date_source?: "title" | "created_time" | null;
};

export type MixcloudImportCategory = "auto_parsed" | "unparsable";

/** Imported rows are excluded; upload-date fallbacks require review. */
export const classifyMixcloudImport = (
	row: ImportSuggestions,
): MixcloudImportCategory | undefined => {
	if (row.show_id != null) return undefined;
	const ready =
		Boolean(row.derived_title?.trim()) &&
		row.derived_date != null &&
		!Number.isNaN(new Date(row.derived_date).getTime()) &&
		Boolean(row.decoded_djs?.length) &&
		row.decoded_djs?.every((name) => name.trim().length > 0) &&
		row.parser_version != null &&
		Boolean(row.parser_key?.trim()) &&
		row.date_source === "title";
	return ready ? "auto_parsed" : "unparsable";
};
