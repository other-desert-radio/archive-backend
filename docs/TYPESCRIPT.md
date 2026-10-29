# TypeScript Conventions

This document is the implementation reference for backend and admin UI
TypeScript. Development stages are defined in
[Development modes](DEVELOPMENT.md#development-modes), when applicable.

## Use type aliases

Use `type` aliases for object shapes and other type definitions. Do not add new
`interface` declarations. Biome enforces this with
`useConsistentTypeDefinitions` configured with `style: "type"`.

```ts
type ArchiveEntry = {
  id: number;
  title: string;
};
```

## Prefer index exports and imports

Export reusable utilities from the nearest `index.ts` barrel and import them
from that barrel. This keeps module boundaries stable and avoids coupling
callers to a utility's implementation filename:

```ts
// src/utils/index.ts
export * from "./undefined-or-empty.js";

// Any caller
import { undefinedOrEmpty } from "../utils/index.js";
```

Use a direct file import only when a module is intentionally private to its
directory or when the barrel would introduce a circular dependency.

## Use `ts-pattern` for normalized boundary data

Use `ts-pattern` as the runtime source of truth when validating or narrowing a
typed value after normalization. This keeps the runtime check and the inferred
branch type together instead of duplicating manual guards:

```ts
const normalized = {
  title: input.title.trim(),
  color: input.color?.trim(),
};

if (!isMatching({ title: P.string.minLength(1) }, normalized)) {
  throw new Error("Title is required");
}

const validInput = normalized;
```

Use patterns such as `P.string.minLength(1)` for non-empty strings and
`P.optional(...)` for optional fields. Normalize first when whitespace should be
treated as empty, then match the normalized value.

For optional strings that have already been trimmed, use the shared
`undefinedOrEmpty` helper from `src/utils/index.ts` instead of repeating an
`undefined`/empty-string check:

```ts
const image = input.image?.trim();
const normalizedImage = undefinedOrEmpty(image) ? null : image;
```

Use the helper consistently for optional text fields such as image, socials, and
tag colors.

## Type explicit route contracts

Use meaningful explicit parameter and return types at public module/framework
boundaries where they clarify the contract. Let local values and straightforward
callbacks use inference rather than repeating obvious types. Fastify routes
declare request and reply contracts with route generics.

```ts
app.get<{ Reply: { 200: ArchiveEntry[]; 500: ErrorResponse } }>(
  "/entries",
  async (_request, reply) => {
    try {
      return entries;
    } catch {
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  },
);
```

## Prefer switches for finite cases

Use a `switch` statement when branching over a finite union or enum of known
cases. Group cases that share behavior and use `default` for the remaining
cases.

## Prefer undefined to null

Use `undefined` for an absent value in backend application code, optional
properties, and function results. Prefer optional properties (`property?: T`)
when omission is the intended meaning. Do not introduce `null` as a second
application-level representation of absence without a concrete integration
reason.

Database boundaries are the important exception: PostgreSQL nullable columns are
represented as `T | null` in Kysely table types because PostgreSQL returns
`NULL`. Convert that value to `undefined` as soon as it leaves the database
access layer when the rest of the backend does not need to preserve the SQL
distinction. Non-null database columns should remain non-null in both the schema
and their TypeScript types.

When a normalized write payload is intentionally shaped for a database insert,
it may retain `null` for nullable columns so the insert object matches the
database contract directly. Keep that choice at the database-facing boundary;
JSON response types should still omit absent optional properties when omission
is the public contract.

## HTTP(S) URL validation

Use `isHttpUrl` from `src/utils/index.ts` for absolute HTTP(S) URL checks in
backend and admin UI code. It uses the URL parser and returns false for invalid
or non-HTTP(S) URLs without throwing. Callers retain responsibility for trimming
stored values, optional-field handling, and validation messages.

## Contracts and safe narrowing

Keep public contracts at their owning module; avoid duplicate shapes across the
call chain. Use generics when they preserve a real relationship between inputs
and outputs, and discriminated unions for alternatives with different required
fields. Preserve the existing `type` preference; interfaces are not required to
express these contracts.

Treat untrusted input as `unknown` until its shape is validated. Check structure
before accessing fields or trimming strings, then normalize and validate
semantic constraints with the existing patterns/helpers. Static types and
assertions do not validate HTTP, file, database JSON, or external-service input
at runtime. Avoid `any`, unsafe casts, and unnecessary non-null assertions;
narrow or handle the absent case. A necessary interop exception should be narrow
and justified. Keep boundary-specific wire/SQL representations separate when
their semantics actually differ, following the absence conventions above.

## Functions and organization

### Readable formatting

Write generated and edited code with the same readable layout as handwritten
code. Expand long query-builder and promise chains onto multiple lines, with one
chained call per line. Put multi-field objects and nested callbacks on separate
indented lines so their structure is easy to scan.

Use a braced block when a conditional body contains a multiline operation. Keep
short expressions compact when they remain easy to read; do not compress
database writes, nested callbacks, or control flow into a single long line.

```ts
if (!unchanged) {
  await transaction
    .insertInto("archive_dataset_versions")
    .values({
      dataset,
      version,
      updated_at: new Date(updatedAt),
      content_hash: hashes[dataset],
    })
    .execute();
}
```

Follow the repository formatter for indentation and wrapping. Format changed
TypeScript files before presenting a chunk for review; keep formatting scoped to
those files to preserve unrelated edits.

### Responsibilities and boundaries

Give functions one understandable responsibility and consistent names throughout
the call chain. Make inputs, outputs, dependencies, and side effects explicit;
pass dependencies such as the database rather than reaching for hidden mutable
state. Keep pure transformations separate from I/O where that improves clarity,
without creating a file or layer for every function. Respect existing module and
UI ownership boundaries and barrel conventions.

Prefer simple functions; use classes only when state, encapsulation, or existing
patterns justify them. Reuse established modules and dependencies before adding
helpers, layers, or abstractions. Keep private helpers local until reuse or
responsibility warrants extraction. Favor readable control flow over cleverness,
speculative features, and unrelated cleanup. Preserve architectural decisions
unless the task justifies changing them.

Propagate failures to the layer responsible for recovery or protocol responses.
Do not swallow errors or turn failure into success-shaped values. Keep mutations
atomic where required; distinguish expected validation/domain failures from
unexpected failures. API status mapping and safe lifecycle logging belong to
[API conventions](api-routes.md), not a second error framework.
