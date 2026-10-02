import type { MixcloudImportTable } from "../../db/types.js";

/** Source fields needed for title parsing and the upload-date fallback. */
export type MixcloudParserInput = Readonly<{
	key: string;
	name: string;
	created_time: string;
}>;

/** Database-facing suggestions, including the unchanged source identity. */
export type MixcloudParserResult = Pick<
	MixcloudImportTable,
	| "key"
	| "derived_title"
	| "derived_date"
	| "decoded_djs"
	| "parser_key"
	| "date_source"
> & { parser_version: number };
