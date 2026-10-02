# Mixcloud Parser

Read this when changing title matchers, DJ normalization, date suggestions, or
read-only parser diagnostics. Tracking storage and the future import workflow
are in [MIXCLOUD_IMPORT.md](MIXCLOUD_IMPORT.md).

## Current parser contract

The shared parser is `parseMixcloudEntry` in
`src/utils/mixcloud-parser/mixcloud-parser.ts`, exported through its folder
barrel and the utils barrel. It accepts the source `key`, `name`, and
`created_time`, preserves the key verbatim, and returns database-facing nullable
suggestions with a non-null `parser_version`. `MIXCLOUD_PARSER_VERSION` is `1`
for the initial title, DJ, and date pipeline. The function tries the ordered
matchers and returns the first match's title, normalized DJ names, and parser
key. Unmatched or excluded titles return `undefined`. Title dates take
precedence over the upload timestamp. English month names and `Sept` are
supported; month/year captures use the first day of that month. Calendar
validation rejects impossible dates rather than allowing rollover. Missing or
invalid title dates fall back to a valid ISO `created_time` timestamp with an
explicit timezone. Both sources produce the UTC calendar day at midnight,
matching `shows.date`; `date_source` identifies the source used. If neither is
valid, both date fields remain null while the title/DJ suggestions are retained.
DJ overrides in `shared.ts` rename exact names or split explicitly listed
collaborations; unlisted names are not split. Names are trimmed before lookup,
and output names are trimmed, stripped of empty entries, and deduplicated in
their original order. It has no file, network, or database side effects and is
not connected to refresh yet. The read-only diagnostic import script calls this
shared function, retains source keys, reports stable parser keys and versions,
and treats undefined results as parse failures. DJ listings use the shared
normalized names without script-local overrides. Missing date suggestions are
reported explicitly; all date conversion and upload-date fallback use the shared
parser. Database persistence follows in a separate reviewed chunk.
`tests/utils/mixcloud-parser.test.ts` checks this contract.

`src/utils/mixcloud-parser/parsers.ts` contains all fourteen regex matchers,
known-DJ prefix fallbacks and their comments from the diagnostic script.
Matching preserves the script's order: specific patterns precede broad
fallbacks, and excluded names return `undefined` before any matcher runs. The
excluded-name set lives in `src/utils/mixcloud-parser/shared.ts`. The
flexible-spacing matcher therefore handles ordinary comma-date titles before the
narrower `common-comma-date` matcher. Known-DJ prefixes run last and escape
literal names before constructing regexes. Each matcher uses a stable text key
as its identifier and diagnostic label; there is no separate parser name.
`ParserFnResult` retains raw `djName`, `title`, and optional `date` captures.
The script uses these shared matchers through `parseMixcloudEntry`. Each matcher
has its own named variable; the `parsers` array lists those variables in
matching order, with example comments kept beside their definitions. Focused
matcher coverage is in `tests/utils/mixcloud-title-parsers.test.ts`.
