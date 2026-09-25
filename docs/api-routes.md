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
POST /api/admin/create-tag
POST /api/admin/create-tags
```

`GET /api/admin/djs` includes each DJ's `createdAt` timestamp in ISO JSON date
format, alongside its identity, metadata, and relationship IDs.

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

Tag creation accepts `{ title: string }` or `{ title: string, color: string }`
for `create-tag`, and an array of those objects for `create-tags`. Tag titles
are trimmed and reused case-insensitively. A color must match
`/^#[0-9a-fA-F]{6}$/`; omitted colors receive a random six-digit hexadecimal
color and `reviewed: false`, while explicit colors receive `reviewed: true`. The
DJ route uses the shared tag service from the Tags module inside its own
transaction rather than calling a Fastify route handler directly.

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

`GET /api/admin/djs/:id/image` returns the stored image bytes for a DJ using the
authenticated admin boundary. It returns `404 { "error": "Not Found" }` when the
DJ or image is absent.

The upload validator accepts JPEG, PNG, and WebP MIME types with matching
filename extensions up to 10 MiB. It stores the original bytes unchanged and
normalizes only the filename metadata; compression and WebP conversion remain
future work. MIME types and extensions are client-provided hints rather than a
security boundary in this initial admin-only workflow.

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
