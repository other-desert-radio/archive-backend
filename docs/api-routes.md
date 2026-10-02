# API Route Conventions

Read this document before adding or changing an API route.

## Authentication

`adminRoutes` in `src/admin/admin.ts` installs the authentication hook and
registers both the `/api/admin/*` API routes and `/admin/*` UI routes. Every
route registered beneath those prefixes is authenticated and requires an admin
session or the configured temporary Basic Auth credentials.

Public routes, such as `/health`, are registered outside `adminRoutes`. Document
route plugin functions with a comment that identifies them as authenticated.

## Route layout

Keep the top-level admin file responsible for the boundary and registration:

```text
src/admin/
  admin.ts
  routes/
    types.ts
    status.ts
    djs/
      index.ts
      djs-route.ts
      types.ts
    shows/
      index.ts
      shows-route.ts
    tags/
      index.ts
      tags-route.ts
```

Each resource subfolder uses `index.ts` as a barrel. Put the implementation in
the named `*-route.ts` file and re-export it from the index:

```ts
export { djRoutes } from "./djs-route.js";
export type { CreateDJRequest } from "./types.js";
```

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
ISO JSON date format. The public Show transformer remains unchanged; `date` is a
broadcast calendar date stored at midnight UTC and returned as an ISO timestamp
for compatibility.

`POST /api/admin/create-show` accepts JSON with required `title`, strict
`YYYY-MM-DD` `date`, positive whole-second `duration`, absolute HTTP(S) `url`,
and one or more existing DJ IDs in `djs`. Optional `image` must be an absolute
HTTP(S) URL; optional `tags` are titles. The route trims text, validates real
calendar dates and URLs, deduplicates DJ IDs and tag titles, and stores the date
at midnight UTC. It creates the Show, relationships, and any missing unreviewed
tags in one transaction, returning `201` with the same admin Show shape as the
list response.

`POST /api/admin/modify-show` accepts the same JSON fields as Show creation plus
required positive safe-integer `id`. Creation and editing share validation and
transactional persistence. Editing replaces all editable metadata, DJ links, and
Show tags while retaining `id` and `createdAt`. Omitted or blank `image` clears
the stored URL; omitted or empty `tags` clears Show tag assignments. At least
one existing DJ remains required. Unlinked DJs and tags are preserved; missing
tag titles are created through the shared tag service. Success returns `200`
with the admin Show shape; an unknown Show returns
`404 { "error": "Not Found" }`. Invalid fields or missing selected DJs return
`400`, and unexpected failures roll back all writes and return `500`.

Tag creation accepts `{ title: string }`, optionally with `color`,
`mixcloud_key`, and `mixcloud_url`, for `create-tag`, and an array of those
objects for `create-tags`. Tag titles and optional Mixcloud metadata are trimmed
before persistence; tag titles are reused case-insensitively. A color must match
`/^#[0-9a-fA-F]{6}$/`; omitted colors receive a random six-digit hexadecimal
color and `reviewed: false`, while explicit colors receive `reviewed: true`. The
DJ route uses the shared tag service from the Tags module inside its own
transaction rather than calling a Fastify route handler directly.

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

`GET /api/admin/djs/:id/image/small` and `GET /api/admin/djs/:id/image/large`
return the corresponding stored WebP image using the authenticated admin
boundary. `GET /api/admin/djs/:id/image` remains an alias for the large image.
Each route returns `image/webp`, or `404 { "error": "Not Found" }` when the DJ
or image is absent.

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
needed. Both routes require admin authentication, validate positive safe-integer
IDs, return `400` for invalid input and `404` for unknown tags, and log failures
before returning generic `500` errors. The Tags UI loads the preview before
enabling confirmation; successful deletion removes the row while retaining
search and sort.

## Mixcloud import list

`POST /api/admin/refresh-mixcloud` requires admin authentication and no request
body. It fetches
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
parse names or write files. The UI button calls this route and reloads the list
after success while preserving search and sort. Refresh failures appear as
human-readable feedback below the toolbar; network, unreadable response, and
table reload failures are identified separately. The shared
`RefreshMixcloudResponse` type is exported from the Mixcloud imports resource
barrel.

Source validation patterns (`PicturesPattern`, `CloudcastPattern`, and
`PagePattern`) live in the resource's `types.ts` and are exported alongside
their `P.infer` types. The combined fetch result uses the inferred page's `data`
type. Invalid cloudcast data rejects the entire refresh.

After fetching and validation, one transaction upserts `mixcloud_import` by
exact source key. It maps source URL, name, and creation timestamp directly,
`audio_length` to duration, `pictures.small/large` to image URLs, and tag keys
to a sorted, deduplicated array. Existing IDs, creation timestamps, Show links,
and import timestamps are preserved; records absent from the fetch are retained.
Changed source metadata on imported rows sets `data_changed`; tag order and
duplicate keys alone do not count as changes. Existing true flags remain true,
including on pending rows. No archive Shows, DJs, or tags are created or
changed. Database failures roll back the entire refresh and return
human-readable `500` errors. Apply migrations through `0021` before refreshing.

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
`created_time` (ISO timestamp), `duration` (seconds), `image_small`, and
`image_large` (image URLs), read directly from `mixcloud_import`, including for
pending records. Duration now represents source metadata rather than the linked
Show duration. Migration `0021` must be applied before using this endpoint.
Show/DJ/tag details come from linked archive records; missing relationships
produce empty arrays. Distinct correlated relationship queries avoid duplicate
imports or IDs. Failures return the generic `500` error.
