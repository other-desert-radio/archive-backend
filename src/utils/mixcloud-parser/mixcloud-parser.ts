import { parsers } from "./parsers.js";
import type { MixcloudParserInput, ParseEntryResult } from "./types.js";

/** Version zero identifies the scaffold; the completed initial pipeline uses one. */
export const MIXCLOUD_PARSER_VERSION = 0;

/** Tries title matchers in order; date conversion and DJ overrides follow later. */
export const parseMixcloudEntry = (
  entry: MixcloudParserInput,
): ParseEntryResult => {
  const result: ParseEntryResult = {
    key: entry.key,
    derived_title: null,
    derived_date: null,
    decoded_djs: null,
    parser_version: MIXCLOUD_PARSER_VERSION,
    parser_key: null,
    date_source: null,
  };
  for (const parser of parsers) {
    const parsed = parser.parse(entry.name);
    if (parsed === undefined) continue;

    return {
      ...result,
      derived_title: parsed.title,
      decoded_djs: [parsed.djName],
      parser_key: parser.key,
    };
  }
  return result;
};
