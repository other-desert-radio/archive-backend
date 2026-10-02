import type { MixcloudParserInput, MixcloudParserResult } from "./types.js";

/** Version zero identifies the scaffold; the completed initial pipeline uses one. */
export const MIXCLOUD_PARSER_VERSION = 0;

export const parseMixcloudEntry = (
  entry: MixcloudParserInput,
): MixcloudParserResult => {
  return {
    key: entry.key,
    derived_title: null,
    derived_date: null,
    decoded_djs: null,
    parser_version: MIXCLOUD_PARSER_VERSION,
    parser_key: null,
    date_source: null,
  };
};
