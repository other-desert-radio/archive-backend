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
  title: P.string,
  image: P.optional(P.string),
  tags: P.optional(P.array(P.string)),
  socials: P.optional(P.string),
  bio: P.string,
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

## Database access and tests

Route plugins receive `TypedDatabase` as an argument; they should not import or
instantiate the global database directly. Keep pure normalization or validation
helpers in `src/utils/` and pass database-derived values into them.

Add focused tests for each new route or helper. Cover successful responses,
invalid request bodies, authentication behavior, and database failures where
applicable. Preserve the authenticated route boundary while testing through
`adminRoutes`.
