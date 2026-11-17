# Show details frontend handoff

Backend export support is implemented. Frontend consumption is a separate task
in `archive-site`; coordinate it before publishing the split. The authoritative
wire contract is [Static Archive Export](ARCHIVE_EXPORT.md#export-rules).

## Files and types

All paths are relative to the site's configured base, currently `/archive/`.
Continue using `resources/shows.json` for browsing fields: IDs, titles, dates,
duration, image URLs, DJ cards, tag IDs, and recording URLs. Descriptions and
tracklists now live only in `resources/show_details.json`, including
descriptions previously embedded in DJ detail shows. There is no new backend
HTTP route.

```ts
type ShowDetail = {
  id: number;
  description?: string;
  tracklist?: Array<
    ({ artist: string; song: string } | { chapter: string }) & {
      start_time?: number;
    }
  >;
};

type ShowDetailsExport = {
  version: number;
  updatedAt: string;
  data: ShowDetail[];
};
```

Each show has one detail record, including `{ id }` when no details exist.
Description HTML is sanitized by the backend. Absent descriptions and empty
tracklists are omitted; empty descriptions remain empty strings. Track order is
meaningful. `start_time` is whole seconds; missing means unknown and zero is
valid. Do not turn missing offsets into zero or offer seek actions for them.

`data_versions.json` adds `show_details: { id, updatedAt }`. Its ID matches the
details envelope's version. Description/tracklist edits change this dataset
independently of shows and DJs. Show additions/deletions can change both
datasets.

## Loading and IndexedDB

1. Keep shows on the shows page's blocking initialization path. Once the show
   store is ready, render browsing and enable navigation/playback.
2. Start details initialization after rendering; do not add it to a shared
   blocking initialization promise. Read cached details asynchronously, then
   refresh in the background if their revision differs from the manifest.
3. Add a `show_details` object store keyed by `id` to the existing IndexedDB
   database. Increment its schema version and preserve playlists, playback,
   search history, metadata, and all existing stores. Update the database type
   map and memory/test adapters as well as the IndexedDB adapter.
4. Reuse the existing versions-store and show-store conventions: cache one
   details initialization request, permit retry after failure, and fetch the
   entire details file only when its independent revision changes.
5. Validate the envelope revision against the manifest before accepting it. Save
   replacement records (clear plus inserts) and the `show_details` metadata
   revision in one transaction. Publish the in-memory replacement only after
   commit; never advance the cached revision on failure. Replacement removes
   deleted records and cleared descriptions/tracklists.
6. On a revision mismatch, retain the previous cache, refresh the manifest, and
   retry once. If still inconsistent, report a retryable details error. Hosting
   caches can briefly expose different export generations.

A loaded `{ id }` record means no details; an unloaded record means loading or
unavailable. Keep those states distinct. Show cached content while refreshing;
without cached content, use a small loading state, then hide empty sections or
show a retry action on failure. Details failure must not fail browsing or
playback. Resolve details by show ID and ignore records absent from the current
show index during transitional cache updates.

## Frontend integration and acceptance

- Update the manifest pattern, dataset-name type, stores, and resource
  validator. Validate detail IDs against the show index, reject duplicate IDs,
  and check timestamps/track-or-chapter shapes. Add coverage for null/omitted
  timestamps, zero, chapters, order, empty records, and sanitized HTML
  consumption.
- Audit show detail pages and every description consumer, including shows on DJ
  pages. Update Astro build-time readers and remove reliance on
  `Show.description`. Route generation still uses the show index; browser
  description/tracklist sections consume the asynchronous details store. Do not
  embed the entire details dataset in generated page HTML.
- Test a fresh cache, an existing IndexedDB upgrade, warm unchanged cache,
  detail-only updates, cleared/deleted details, transaction failure, offline
  refresh, revision mismatch, and failed-request retry. Verify one shared
  request rather than duplicate downloads from multiple components.
- In a browser, delay or fail the details request: browsing and playback must
  work before it finishes. Confirm detail rendering, chapter ordering, timestamp
  seeking, and accessible loading/error states. Repeat with cached data offline.

## Compression and rollout

Use ordinary `fetch(...).json()` against the `.json` URL. GitHub Pages already
negotiates gzip and the browser automatically decompresses the response. A
client requesting `identity` receives uncompressed JSON. No `.gz` URLs,
JavaScript decompressor, dependency, or manual `Accept-Encoding` header is
needed.

Verified on 2026-11-16 against the deployed `/archive/resources/shows.json`:
`Accept-Encoding: gzip` returned `200` and `Content-Encoding: gzip`;
`Accept-Encoding: identity` returned `200` without content encoding. Both
responses included `Vary: Accept-Encoding`. Verify these responses again for
`show_details.json` after rollout, and compare the decoded JSON payloads. Local
development servers may serve uncompressed JSON; consumption is identical.

Deploy frontend compatibility first: tolerate a missing `show_details` manifest
entry/file and continue using legacy embedded descriptions until the new dataset
is present. Once present, the details dataset is authoritative, including
cleared fields. Then apply backend migration `0045` and publish the split.
Verify the site build/resource validator before deploying the generated site. Do
not delete the legacy fallback until the transition is verified. Backend
migration startup is explicit; application startup does not migrate.

Local read-only snapshot measured on 2026-11-16: 310 shows, 3,216 tracklist
entries. Sizes use pretty-printed envelopes and gzip; production compression can
differ.

| File                | Raw bytes | Gzip bytes |
| ------------------- | --------: | ---------: |
| `shows.json`        |   227,981 |     26,195 |
| `show_details.json` |   380,787 |     87,895 |
| Both split files    |   608,768 |    114,090 |

The earlier combined export was approximately 600 KB raw / 119 KB gzip. The
blocking show download is now about 26 KB gzip, with about 88 KB deferred.
IndexedDB and parsed objects hold decoded data, not gzip bytes. Device timings
and frontend acceptance remain unverified until the consumer is implemented.
