import { parseCreatedTimeDate, parseTitleDate } from "./dates.js";
import { parsers } from "./parsers.js";
import { excludedShowNames, manualDJOverrides, renameDJ } from "./shared.js";
import type { MixcloudParserInput, ParseEntryResult } from "./types.js";

/** Versions the title, DJ normalization, and date extraction pipeline together. */
export const MIXCLOUD_PARSER_VERSION = 2;

/** Returns the first title match, or undefined for excluded or unmatched titles. */
export const parseMixcloudEntry = (
	entry: MixcloudParserInput,
): ParseEntryResult | undefined => {
	if (excludedShowNames.has(entry.name)) {
		return undefined;
	}

	for (const parser of parsers) {
		const parsed = parser.parse(entry.name);
		if (parsed === undefined) {
			continue;
		}

		// Repair parsed names before resolving DJ identities.
		const djName = parsed.djName.trim();
		const resolvedDJNames = manualDJOverrides.get(djName) ?? djName;
		const djNames = Array.isArray(resolvedDJNames)
			? resolvedDJNames
			: [resolvedDJNames];
		const nonEmptyDJNames = djNames.map((name) => name.trim()).filter(Boolean);
		const decodedDJs = [...new Set(nonEmptyDJNames.map(renameDJ))];

		const titleDate = parseTitleDate(parsed.date);
		const derivedDate = titleDate ?? parseCreatedTimeDate(entry.created_time);

		return {
			key: entry.key,
			derived_title: parsed.title,
			derived_date: derivedDate ?? null,
			decoded_djs: decodedDJs,
			parser_version: MIXCLOUD_PARSER_VERSION,
			parser_key: parser.key,
			date_source: derivedDate ? (titleDate ? "title" : "created_time") : null,
		};
	}

	return undefined;
};
