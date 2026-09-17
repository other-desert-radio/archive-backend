# TypeScript Conventions

This document is the implementation reference for TypeScript style in the
backend.

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

## Type explicit route contracts

Add explicit types wherever TypeScript supports them, especially at framework
boundaries. Fastify routes should declare their request and reply contracts with
route generics instead of relying on inference alone.

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
