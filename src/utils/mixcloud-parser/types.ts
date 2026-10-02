import type { MixcloudImportTable } from "../../db/types.js";

/** Source fields needed for title parsing and the upload-date fallback. */
export type MixcloudParserInput = Readonly<{
	key: string;
	name: string;
	created_time: string;
}>;

/** Database-facing suggestions, including the unchanged source identity. */
export type ParseEntryResult = Pick<
	MixcloudImportTable,
	| "key"
	| "derived_title"
	| "derived_date"
	| "decoded_djs"
	| "parser_key"
	| "date_source"
> & { parser_version: number };

/** Raw title captures; DJ normalization and date conversion happen later. */
export type ParserFnResult = {
	djName: string;
	title: string;
	date?: string;
};

export type ShowTitleParser = {
	parse: (name: string) => ParserFnResult | undefined;
	key: string;
};
