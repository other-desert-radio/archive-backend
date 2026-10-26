# API Route Conventions

Read this document before adding or changing an API route.

## Authentication

`adminRoutes` in `src/admin/admin.ts` protects `/api/admin/*` with a Better Auth
cookie session. Admins and editors can manage archive resources; only admins can
list, create, delete, reset passwords, or change roles for accounts. The
`/admin/*` shell and `/health` are public. Basic Auth is removed.

Browser auth routes allow sign-in, session lookup, and sign-out under
`/api/auth/*`. Public signup and direct Admin plugin/alternate password mutation
routes are blocked. Account mutations require a trusted Origin. Never expose
password hashes, tokens, or plaintext passwords in API responses or logs.

- `GET /api/admin/users` returns
  `{id,email,role,mustChangePassword,banned,banReason?,banExpires?,mixcloudName?,mixcloudKey?}[]`
  (ban expiry is an ISO timestamp; absent optional values are omitted).
- `POST /api/admin/create-user` accepts `{email,password,role}`.
- `POST /api/admin/modify-user-role` accepts `{id,role}`.
- `POST /api/admin/reset-user-password` accepts `{id,password}`.
- `POST /api/admin/remove-user` accepts `{id}` and returns `{id}`.
- `POST /api/account/change-password` accepts `{currentPassword,newPassword}`.

Create, role change, and reset return the user summary. Admin-supplied passwords
require replacement before archive access; protected requests return 403 with
`code: "PASSWORD_CHANGE_REQUIRED"`. Passwords must contain 8–128 characters;
spaces are preserved. Reset and role changes revoke existing sessions.
Management mutations serialize with a database lock; self-deletion,
self-demotion, and removing the last admin are rejected. Errors use
`{error,code?}`.

Document resource route plugins as authenticated and register them beneath the
shared boundary rather than duplicating permission checks.

## Route layout

### Mixcloud connection routes

Admins and editors use their own archive session for these routes. No route
accepts a user or session ID from the browser. Responses use
`Cache-Control: no-store`.

- `GET /api/admin/mixcloud/status` returns `{configured:false,connected:false}`
  when disabled, `{configured:true,connected:false}` when disconnected, or
  `{configured:true,connected:true,account:{key,displayName}}` when connected.
  Status reads only account identity, never the stored access token.
- `POST /api/admin/mixcloud/connect` creates a session-bound authorization
  attempt and returns `{authorizationUrl}` for the browser to navigate to
  Mixcloud. Normal browser origin checks apply. Disabled integrations return 503
  with `{error:"Mixcloud is not configured"}`. Storage failures return a generic
  500; raw database errors and generated state are excluded from route logs.

- `GET /api/admin/mixcloud/callback` requires the initiating archive session and
  a single nonempty `state`. The store validates session ownership, attempt
  expiry and single use before invoking code exchange and identity lookup, then
  saves the encrypted connection. Provider denial or failure consumes the
  attempt while preserving an existing connection. Success/failure uses a 303
  redirect to `/admin/?mixcloud=OUTCOME#upload`, where OUTCOME is `connected`,
  `denied`, `invalid_attempt`, `unavailable`, or `failed`. These markers are
  informational; the UI must fetch status as the source of truth. No provider
  text, credentials, or caller-supplied redirect destination is forwarded.
  Missing/invalid archive sessions retain the shared boundary's 401/403
  response.
- `POST /api/admin/mixcloud/disconnect` returns `{disconnected:true}` after
  deleting the acting user's connection and pending attempts. It is idempotent,
  requires a trusted browser origin, and serializes with callback completion.
  Disabled integrations return 503. This does not log out of Mixcloud or revoke
  authorization at the provider.

- `POST /api/admin/mixcloud/upload` accepts multipart `title`, `date` (valid
  calendar show date, not publication scheduling), `tags` (JSON array of up to
  five nonblank names), and exactly one nonempty `.mp3` file, up to 4 billion
  bytes. It inherits session and trusted-origin protections. The audio streams
  to private temporary storage, is parsed with `music-metadata` to require MPEG
  Layer III audio, and is deleted before the response. Invalid requests return
  400; multipart size/count limits return 413; storage errors return 500, all
  with `{success:false}`. Valid requests currently return HTTP 501 with
  `{success:false}` because provider upload is not implemented. No token access,
  provider calls, or database writes occur yet. Completed provider uploads will
  return `{success:true}`. Upload lifecycle logs include received byte count,
  validation rejection reasons, detected codec/sample rate, cleanup, final
  status, and elapsed milliseconds. Request logs provide the correlation ID;
  audio bytes, metadata values, credentials, and temporary paths are not logged.

Mixcloud responses also use `Referrer-Policy: no-referrer`. Application, admin,
and origin-rejection request logs record paths without query strings to exclude
OAuth codes, state, and tokens. Raw provider and storage errors are not logged
by the Mixcloud handlers. The upload page consumes these routes and reloads
status after authorization; the callback marker alone never establishes a
connection.

### Resource plugin registration

Keep the top-level admin file responsible for the boundary and registration:

```text
src/admin/
  admin.ts
  routes/
    types.ts
    status/
      index.ts
      status-routes.ts
      routes/
        get-admin-status.ts
    djs/
      index.ts
      djs-routes.ts
      types.ts
      serve-dj-image.ts
      routes/
        list-djs.ts
        get-dj-image.ts
        get-dj-default-image.ts
        create-dj.ts
        modify-dj.ts
        remove-dj.ts
    shows/
      index.ts
      shows-routes.ts
      routes/
        list-shows.ts
        create-show.ts
        modify-show.ts
    tags/
      index.ts
      tags-routes.ts
      routes/
        list-tags.ts
        ...
```

Each resource subfolder uses `index.ts` as its public barrel. The named
`*-routes.ts` file owns the complete HTTP method/path map, wires handlers, and
registers shared plugin hooks. Re-export the plugin from the index:

```ts
export { djRoutes } from "./djs-routes.js";
export type { CreateDJRequest } from "./types.js";
```

Give every endpoint a private handler file in the resource's nested `routes/`
directory. Handlers receive only their required dependencies, declare typed
Fastify request/reply parameters, and own validation, persistence, logging, and
responses. Keep shared wire contracts in the resource's `types.ts` and shared
helpers at the resource root. Import private handlers directly; they do not need
public barrel exports.

For example, `djs-routes.ts` registers
`app.post<CreateDJRoute>("/create-dj", createDJHandler(database))` and imports
the handler from `./routes/create-dj.js`. Handler files do not register URLs.
When two endpoints share behavior, keep their individual handlers and extract
the shared implementation, such as `serve-dj-image.ts` for both image endpoints.
Preserve existing helpers rather than adding a service layer just for this
split.

Keep authorization, origin checks, multipart setup, and plugin lifecycle hooks
at their existing registration boundaries. Publication owns its active stream
set and shutdown hook; its events handler receives that set. Auth/account
registration files, public SPA routes, and the health route also delegate to
separate handler files. Each group uses the same `index.ts`, `*-routes.ts`, and
nested `routes/` layout. Auth/account and health groups live in `src/routes/`;
admin resource, status, and UI groups live in `src/admin/routes/`. Better Auth
remains behind its single allowlisted wildcard proxy; provider internals are not
application-owned route handlers.

Register the resource plugin from `adminApiRoutes` and pass the typed database
into it:

```ts
await app.register(djRoutes(database));
```

## Shared route types

Use `TypedDatabase`, `ErrorResponse`, and `AdminApiReply` from
`src/admin/routes/types.ts`:

```ts
export type TypedDatabase = Kysely<Database>;

export type ErrorResponse = {
  error: string;
};

export type AdminApiReply<T> = {
  200: T;
  201: T;
  400: ErrorResponse;
  500: ErrorResponse;
};
```

Use `AdminApiReply<T>` for successful resource responses instead of repeating
error response shapes in each route.

## Request validation with `ts-pattern`

For structured request bodies, define the pattern beside the resource route
types and infer the TypeScript type from that pattern. Keep the pattern as the
runtime source of truth:

```ts
import { P } from "ts-pattern";

export const CreateDJRequestPattern = {
  title: P.string.minLength(1),
  image: P.optional(P.string.minLength(1)),
  tags: P.optional(P.array(P.string.minLength(1))),
  socials: P.optional(P.string.minLength(1)),
  showTitle: P.optional(P.string.minLength(1)),
  showDescription: P.optional(P.string.minLength(1)),
  bio: P.string.minLength(1),
} as const;

export type CreateDJRequest = P.infer<typeof CreateDJRequestPattern>;
```

Validate the incoming body with `isMatching` before using it:

```ts
if (!isMatching(CreateDJRequestPattern, request.body)) {
  return reply.code(400).send({ error: "Validation error" });
}
```

For Fastify request generics, type the request body with `Body` and the response
with `Reply`:

```ts
app.post<{
  Body: CreateDJRequest;
  Reply: AdminApiReply<CreatedDJ>;
}>("/create-dj", async (request, reply) => {
  // request.body is validated before persistence.
});
```

Use `400` for invalid client input and `500` for unexpected database or server
failures. Log unexpected failures with `request.log.error` before returning the
generic internal-error response.

The current authenticated mutation routes are:

```text
POST /api/admin/create-dj
POST /api/admin/create-show
POST /api/admin/modify-show
POST /api/admin/create-tag
POST /api/admin/create-tags
POST /api/admin/modify-tag
```

`GET /api/admin/djs` includes each DJ's `createdAt` timestamp in ISO JSON date
format, alongside its identity, metadata, and relationship IDs. Its admin-only
`directTags` array distinguishes directly assigned DJ tags from the combined
`tags` array, which also includes tags inherited through linked shows.

`GET /api/admin/shows` includes the admin-only `createdAt` timestamp in the same
ISO JSON date format, plus required `image_small` and `image_large` URLs. The
public Show transformer remains unchanged; `date` is a broadcast calendar date
stored at midnight UTC and returned as an ISO timestamp for compatibility.

`POST /api/admin/create-show` accepts JSON with required `title`, strict
`YYYY-MM-DD` `date`, positive whole-second `duration`, absolute HTTP(S) `url`,
one or more existing DJ IDs in `djs`, and required absolute HTTP(S)
`image_small` and `image_large` URLs. Optional `tags` are titles. The route
trims text, validates real calendar dates and URLs, deduplicates DJ IDs and tag
titles, and stores the date at midnight UTC. It creates the Show, relationships,
and any missing unreviewed tags in one transaction, returning `201` with the
same admin Show shape as the list response.

Creation also accepts optional positive safe-integer `mixcloud_import_id`. After
validating submitted metadata, an import locks that tracking row with
`FOR UPDATE`. A pending row creates the Show, links, and missing tags and sets
`show_id`/`imported_at` together while clearing `data_changed`, all in one
transaction. Submitted URL and image URLs are persisted without source-row
replacement; both images remain required. Unknown tracking IDs return `404`. An
already imported row returns `200` with the current admin Show and performs no
writes, preserving the import timestamp. Concurrent requests serialize to one
creation. Unexpected failures roll back every write and return generic `500`.
The optional ID is request context, not a Show column.

`POST /api/admin/modify-show` accepts the same JSON fields as Show creation plus
required positive safe-integer `id`. Creation and editing share validation and
transactional persistence. Editing replaces all editable metadata, DJ links, and
Show tags while retaining `id` and `createdAt`. Both image URLs are required on
every save; omitted, blank, relative, and non-HTTP(S) image URLs return `400`.
Public JSON exposes both image URL fields; migration `0024` removes the legacy
database column. Omitted or empty `tags` clears Show tag assignments. At least
one existing DJ remains required. Unlinked DJs and tags are preserved; missing
tag titles are created through the shared tag service. Success returns `200`
with the admin Show shape, including both image URLs; an unknown Show returns
`404 { "error": "Not Found" }`. Invalid fields or missing selected DJs return
`400`, and unexpected failures roll back all writes and return `500`.

Tag creation accepts `{ title: string }`, optionally with `color`,
`mixcloud_key`, and `mixcloud_url`, for `create-tag`, and an array of those
objects for `create-tags`. Tag titles and optional Mixcloud metadata are trimmed
before persistence; tag titles are reused case-insensitively. Database migration
`0035` requires trimmed, nonblank stored titles and enforces case-insensitive
uniqueness even for concurrent requests. Creation reuses the winning row without
changing its color, review state, or source metadata. A creation conflict skips
the insert and selects the existing tag; it does not issue an UPDATE. The
attempted INSERT still advances the publication revision once, including when no
row is inserted, under the existing statement-trigger contract. Reusing a tag
found by the initial lookup performs no write and advances no revision. A
conflicting rename returns `400` after its transaction rolls back. A color must
match `/^#[0-9a-fA-F]{6}$/`; omitted colors receive a lowercase six-digit
hexadecimal color (hue 0–360°, saturation 84–96%, lightness 62–77%) and
`reviewed: false`, while explicit colors receive `reviewed: true`. The DJ route
uses the shared tag service from the Tags module inside its own transaction
rather than calling a Fastify route handler directly.

`GET /api/admin/tags` includes optional `mixcloud_key` and `mixcloud_url` fields
when a tag is associated with a Mixcloud genre; absent database values are
omitted from the JSON response.

`POST /api/admin/create-dj` accepts `multipart/form-data` with required `title`
and `bio` text fields, optional `tags`, `socials`, `showTitle`, and
`showDescription` text fields, and an optional `image` file field. Tags are
submitted as a comma-separated string. JSON requests are no longer accepted by
this route. Admin API request logs include the request method, URL, content
type, content length, and user agent. DJ multipart logs include field names and
safe file metadata such as filename, MIME type, and byte length, but never image
bytes or form contents. Application events use readable labels such as
`[DJ Creation]` and `[DJ Creation [image upload]]` and include a shortened
browser identifier.

`POST /api/admin/modify-dj` accepts multipart form data with required numeric
`id`, `title`, `bio`, `tags`, and boolean `removeImage` fields. It replaces all
editable DJ metadata and direct DJ tags in one transaction: blank optional text
fields clear their stored values, and `tags` replaces the direct-tag set without
changing tags inherited from linked shows. An optional `image` is validated and
processed like DJ creation; omitting it preserves the current image unless
`removeImage` is true, which clears both stored WebP variants. A request cannot
both upload an image and request its removal. The multipart limit permits all
eight documented text fields and one optional image file. Successful edits
return `200` with the admin DJ shape; an unknown DJ returns
`404 { "error": "Not Found" }`.

Both DJ mutation routes trim `title` and `bio` before validating them. Blank or
whitespace-only required text returns `400 { "error": "Validation error" }`
before image processing or database writes.

`GET /api/admin/djs/:id/image/small` and `GET /api/admin/djs/:id/image/large`
return the corresponding stored WebP image using the authenticated admin
boundary. `GET /api/admin/djs/:id/image` remains an alias for the large image.
Each route returns `image/webp`, or `404 { "error": "Not Found" }` when the DJ
or image is absent.

Both DJ mutation routes cap each uploaded file at 10 MiB while reading the
multipart stream, before image processing or database writes. Larger files
return `413 { "error": "Image must not exceed 10 MiB" }`, including unsupported
file types. This server limit applies to the submitted crop; original browser
source selection is unchanged.

The upload validator accepts JPEG, PNG, and WebP MIME types. The DJ admin UI
validates and decodes a selected source before opening its crop modal, then
sends a 1200-by-1200 WebP crop. Crop controls support drag positioning, zoom,
and 90-degree left/right rotation. Before the creation transaction, Sharp
creates exact 400-by-400 and 1024-by-1024 WebPs from that crop. The transaction
stores only the two generated variants; it does not retain the submitted bytes
or filename. A decoding failure returns
`400 { "error": "Image could not be processed" }` without creating a DJ or tags.
The MIME type is client-provided metadata, while Sharp is the actual content
decoder.

## Logging new features

Every new backend feature or workflow must emit readable application events at
the points where work starts, succeeds, is rejected, or fails unexpectedly. Use
a bracketed feature label followed by the event and its key context in the
message itself:

```ts
request.log.info(
  { recordId: created.id, client: clientDescription(request) },
  `[Feature Name] record created -- id: ${created.id}, name: ${created.title}`,
);
```

Messages must answer “what happened, to what, and where?” without requiring the
operator to expand the structured metadata. Include relevant IDs, names, URLs,
field names, status codes, filenames, sizes, and a shortened client identifier
where applicable. Keep additional machine-readable context in the structured
object; the server formats it underneath the message in gray text. Use `info`
for normal lifecycle events, `warn` for rejected input, and `error` with
`{ err: error }` for unexpected failures before returning a generic server
error.

Never log passwords, authorization headers, full request bodies, form values,
image/audio bytes, or other secrets. For uploads, log only safe metadata such as
the field name, filename, MIME type, and byte length. Add focused tests when
introducing a new logging formatter or event helper.

## Database access and tests

Route plugins receive `TypedDatabase` as an argument; they should not import or
instantiate the global database directly. Keep pure normalization or validation
helpers in `src/utils/` and pass database-derived values into them.

Add focused tests for each new route or helper. Cover successful responses,
invalid request bodies, authentication behavior, and database failures where
applicable. Preserve the authenticated route boundary while testing through
`adminRoutes`.

## Tag editing

`POST /api/admin/modify-tag` requires an `edit_type` discriminator. For
`edit_type: "full_edit"`, it accepts required positive safe-integer `id`,
`title`, and `color`, plus optional string `mixcloud_key` and `mixcloud_url`.
All text is trimmed. Title must be nonempty, color must be `#RRGGBB`, and a
nonempty Mixcloud URL must be absolute HTTP(S). Blank or omitted metadata clears
its respective column independently. Every successful metadata save marks the
tag reviewed, including unchanged saves.

The transaction checks the target and rejects another tag with the same title
ignoring case and surrounding whitespace. Case-only renames are allowed. It
updates the existing row, preserving ID, creation timestamp, and all
relationships. Success returns `200` with the list endpoint's `TagsJSON` item
shape; an unknown ID returns `404`, invalid fields or conflicting titles return
actionable `400` errors, and unexpected failures roll back and return `500`.
Lifecycle logs omit form values. Matching remains application-level; no global
uniqueness constraint or migration is added.

For `edit_type: "review"`, the request is
`{ edit_type: "review", id, reviewed: boolean }`. It updates only `reviewed`,
allowing both `true` and `false`, and preserves metadata, identity, creation
timestamp, and relationships. It skips rename collision checks and does not
clear omitted Mixcloud fields. ID validation is the same positive safe-integer
rule as full edits. Metadata fields in review requests and a `reviewed` value in
full edits are rejected with `400`; missing or unknown `edit_type` values are
also rejected. Runtime patterns define the shared discriminated request union,
and exhaustive `ts-pattern` matches normalize each operation and choose its
persistence behavior. Both operations share the transaction, transformed
response, authentication, and error handling. Success returns the updated
`TagsJSON` item; missing targets return `404`, and unexpected failures roll back
and return `500`.

For `edit_type: "partial_edit"`, the request requires `id` and at least one of
`title`, `color`, `mixcloud_key`, or `mixcloud_url`. Omitted fields remain
unchanged. Supplied strings are trimmed and use full-edit validation; blank
Mixcloud fields clear only their respective column. Null field values and an
explicit `reviewed` value are rejected. Title collision checks run only when a
title is supplied. Every successful partial edit marks the tag reviewed,
including unchanged saves. It shares full-edit authentication, transaction,
response, logging, and error behavior, preserving identity, creation timestamp,
and relationships. For example,
`{ edit_type: "partial_edit", id: 1, color: "#abcdef" }` changes only color and
review status. No migration is needed.

## Tag hard deletion

`GET /api/admin/tags/:id/delete-impact` returns an object with
`tag: { id, title }`, `shows: [{ id, title }]`, and
`djs: [{ id, title, assignment }]`. DJ `assignment` is `direct`, `inherited`, or
`both`; inherited assignments come through linked Shows. Lists are deduplicated
and sorted by title, then ID. Unassigned tags return empty lists. The preview is
advisory; assignments can change before confirmation.

`POST /api/admin/remove-tag` accepts JSON `{ id }` and returns `200 { id }`. It
permanently deletes the tag in one atomic statement. Existing foreign-key
cascades remove all direct DJ and Show tag assignments present at deletion time;
Shows, DJs, their mutual links, and other tags remain intact. No migration is
needed. Both routes require an admin or editor session, validate positive
safe-integer IDs, return `400` for invalid input and `404` for unknown tags, and
log failures before returning generic `500` errors. The Tags UI loads the
preview before enabling confirmation; successful deletion removes the row while
retaining search and sort.

## Mixcloud import list

`POST /api/admin/refresh-mixcloud` requires an admin or editor session and no
request body. It fetches
`https://api.mixcloud.com/otherdesertradio/cloudcasts/?limit=100&offset=0` and
follows `paging.next`, combining all source records into `{ data: [...] }` in
request-local memory. It returns `200 { "status": "ok" }` after all pages
complete and source metadata is saved, logging start and completion with the
persisted count. Each page has a 30-second timeout; failed requests, invalid
JSON/page envelopes or cloudcast records, or repeated pagination URLs stop the
refresh without retries and return human-readable `500` errors identifying
fetch/validation or save failures after logging the failure. Source records are
retained unchanged; this chunk validates the cloudcast fields used by the
importer, including nested tags and small/large picture strings, against the
structure in `src/res/mixcloud.json`. Unused fields are excluded from validation
for performance and remain documented as comments in the patterns. It does not
write files. After source validation, it calls `parseMixcloudEntry` for every
cloudcast and logs matched/unmatched counts and parser version. Successful
matches save all six parser fields in the source upsert transaction, on both
insert and refresh. Parser results are reused for persistence. Unmatched or
excluded titles clear stale suggestion fields and record the current parser
version, on both insert and refresh. The UI button calls this route and reloads
the list after success while preserving search and sort. Refresh failures appear
as human-readable feedback below the toolbar; network, unreadable response, and
table reload failures are identified separately. The shared
`RefreshMixcloudResponse` type is exported from the Mixcloud imports resource
barrel.

Source validation patterns (`PicturesPattern`, `CloudcastPattern`, and
`PagePattern`) live in the resource's `types.ts` and are exported alongside
their `P.infer` types. The combined fetch result uses the inferred page's `data`
type. `created_time` must match the shared ISO timestamp regex (seconds and an
explicit `Z` or numeric timezone, optional fractional seconds) and pass calendar
and time-range validation. Invalid cloudcast data rejects the entire refresh.
The diagnostic import script validates its bundled JSON with `PagePattern`
before parsing; malformed source data throws `Invalid Mixcloud JSON`.

After fetching and validation, one transaction upserts `mixcloud_import` by
exact source key. It maps source URL, name, and creation timestamp directly,
`audio_length` to duration, `pictures.large` to `image_small`,
`pictures["1024wx1024h"]` to `image_large`, and tag keys to a sorted,
deduplicated array. Existing IDs, creation timestamps, Show links, and import
timestamps are preserved; records absent from the fetch are retained. Changed
source metadata on imported rows sets `data_changed`; tag order and duplicate
keys alone do not count as changes. Existing true flags remain true, including
on pending rows. No archive Shows, DJs, or tags are created or changed. Database
failures roll back the entire refresh and return human-readable `500` errors.
Apply migrations through `0022` before refreshing.

Refresh logs include page URLs, response status/timing, validated page and total
counts, next URLs, the save stage, progress every 100 records, and commit
timing. Save failures log the source key and rollback context. Request IDs
connect all stages. Browser failures that prevent requests reaching the API
cannot produce server-stage logs; the UI advises checking the table before
retrying a request that received no response.

`GET /api/admin/mixcloud-imports` is authenticated and read-only. Its resource
plugin, response type, and barrel live in `src/admin/routes/mixcloud-imports/`.
It returns every tracking record in ID order, including unimported records. Each
row includes `id`, `key`, required boolean `data_changed`, `djs` (numeric IDs),
`dj_names` (strings aligned with ascending DJ IDs), and `tags` (ascending Show
tag IDs). Optional `show_id`, `imported_at` (ISO timestamp), and `show_name` are
omitted when absent. Source metadata includes optional `url`, `name`,
`mixcloud_tags` (array of source `{key, name, url}` objects, omitted when
unknown; an empty array means no source tags), `created_time` (ISO timestamp),
`duration` (seconds), `image_small`, and `image_large` (image URLs), read
directly from `mixcloud_import`, including for pending records. Duration now
represents source metadata rather than the linked Show duration. Optional parser
suggestions are `derived_title` (string), `derived_date` (ISO timestamp),
`decoded_djs` (extracted DJ name strings, not archive IDs), `parser_version`
(integer), `parser_key` (stable text matcher identifier), and `date_source`
(`title` or `created_time`). Null parser fields are omitted independently,
preserving partial results; non-null empty DJ arrays and parser version zero are
included. Suggestions come directly from the source row, independently of linked
Show/DJ details. Refresh populates suggestions for successful matches.
Parser-only changes do not set `data_changed`, and no archive records are
modified. Migration `0022` must be applied before using this endpoint.
Show/DJ/tag details come from linked archive records; missing relationships
produce empty arrays. Distinct correlated relationship queries avoid duplicate
imports or IDs. Failures return the generic `500` error.

### Mixcloud readiness counts

Authenticated `GET /api/admin/mixcloud-import/status` returns
`{ auto_parsed: number, unparsable: number, missing_djs: string[] }` for pending
rows (`show_id IS NULL`). Ready rows have a nonblank derived title, a valid
derived date, nonempty decoded DJ names, parser version/key, and
`date_source: "title"`. Every decoded DJ name must also match an existing
`djs.title` exactly, ignoring case and surrounding whitespace. Any unmatched
name requires review. Both status and list queries compute `decoded_djs_exist`
against the current DJ records; the list returns that boolean so the shared
classifier also places these rows in the UI's needs-review queue. No DJ records
are created. Upload-date fallbacks and missing suggestions require review.
Counts exclude already imported rows and do not depend on table search.
`missing_djs` lists unmatched nonblank decoded names across pending entries,
including entries requiring review for additional reasons. Names are trimmed,
deduplicated ignoring case, and sorted alphabetically; the first spelling in
import ID and decoded-name order is retained. Imported rows are excluded. Empty
queues return zero counts and `missing_djs: []`; database failures return
`500 { "error": "Internal Server Error" }`. The shared `classifyMixcloudImport`
utility keeps API counts and UI filters consistent.

## Mixcloud tag key resolution

Authenticated `POST /api/admin/validate-tags` preserves the existing
`{ tags: string[] }` title-validation request and response. Its alternative
request is `{ mixcloud_keys: string[] }`, returning
`{ valid: [{ key, tag: { id, title, color } }], invalid: string[] }`. Keys match
stored `mixcloud_key` values exactly, without trimming or case folding. Repeated
keys are deduplicated in first-occurrence order. Missing keys and keys assigned
to multiple archive tags are invalid. Empty arrays return empty results.
Combining both request variants or supplying non-string keys returns `400`;
authentication and generic database-error handling are unchanged. This operation
creates or modifies no tags.

### Original Mixcloud tag names

Migration `0025_add_mixcloud_source_tags` adds nullable `mixcloud_tags` JSONB to
source tracking. Refresh stores sorted, deduplicated `{ key, name, url }`
objects while preserving original names and capitalization. The authenticated
import-list response includes optional `mixcloud_tags`; null means source names
have not yet been fetched. Existing rows require refresh after applying the
reviewed migration. Source key, name, and URL changes mark linked imports
changed, including refreshing incomplete legacy JSON. Database tag names take
precedence for matching keys in the import form; otherwise selected new source
tags use create-tag with their key and URL without lowercasing. No archive tags
are modified by this migration or source refresh.

Source tag JSON now retains `{key, name, url}` on refresh. Older JSON without
URLs remains readable and gains URLs on the next refresh. The import modal
resolves keys from this JSON. Migration `0026` removes the legacy keys column
and API field. On Save, selected new source tags go through
`POST /api/admin/create-tag` with `title`, `mixcloud_key`, and `mixcloud_url`
before Show creation. Removed source tags are excluded; manually added titles
retain normal Show tag creation. Missing URLs on selected new source tags
require a refresh. Tag creation and Show creation are separate requests: a
failed Show save can leave an unassigned tag, which is reused on retry.

## Archive publication

Publication endpoints require an administrator session; editors receive `403`.
They share the admin session, required-password-change, and same-origin mutation
boundary. Local publication success means assets were written to the checkout;
remote success means pushed to GitHub, without waiting for Pages.

- `GET /api/admin/publication` returns `mode`, `target`, decimal-string
  `revision` and `publishedRevision`, `pending`, and optional `latestJob`.
- `POST /api/admin/publication/preview` accepts `{}` or `{ retryJobId }` in both
  modes and returns a prepared summary: `{ id, expiresAt, revision, changes }`.
  Each of `changes.tags`, `changes.shows`, and `changes.djs` contains `added`,
  `changed`, and `removed` arrays of names. Preparation runs within the request;
  the browser shows loading until it completes. Remote mode compares with the
  fetched target branch; local mode compares current generated checkout files.
  The backend briefly retains the reviewed documents in memory. No preview
  polling or image endpoints are needed. Preparation leaves working-tree files
  and the index untouched; local preparation works without Git or network
  access.
- `POST /api/admin/publication` accepts `{ previewId, retryJobId? }` in both
  modes, reserves a durable job, and returns `202` with its metadata. Admission
  requires a ready, owned, unexpired preview for the same retry and target.
  Database revision, remote target branch, or local generated-file changes
  return `409` and require a fresh preview before confirmation. Concurrent
  starts return `409`, invalid input returns `400`, and unknown retry jobs
  return `404`. Retry requires a failed or interrupted job. Closing a browser or
  modal does not cancel execution.
- `GET /api/admin/publication/jobs/:jobId` returns
  `{ job, logs, logsTruncated }`, with ordered, sanitized log lines. Unknown
  jobs return `404`.
- `GET /api/admin/publication/events` streams SSE `data` messages containing
  `{ type: "status", status }` and `{ type: "job", detail }`. Every connection
  reads durable state, so reconnect needs no event cursor. PostgreSQL
  notifications prompt reads after archive/job/log transactions commit; a
  two-second durable polling fallback tolerates notification outages. Sessions
  and administrator permission are revalidated on reads; revoked or expired
  sessions close the stream. Heartbeat comments keep idle connections alive.

Job `target` and status `target` include `mode` and `checkoutPath`. Remote
targets include repository and branch; local targets include the actual branch
and origin when available. Local publication never fetches, commits, or pushes.
Changing mode or destination makes publication pending for the new target;
retries cannot cross targets. Failed jobs from a different target do not block a
fresh publication. Successful jobs acknowledge only their captured revision.

Unexpected publication failures are logged and return an operation-specific
`500` message with recovery guidance and a request ID for server-log lookup.
Stream failures close the connection for browser reconnection. Revisions remain
decimal strings throughout JSON to preserve bigint precision. No endpoint
accepts Git commands, repository paths, or branch overrides from clients.
