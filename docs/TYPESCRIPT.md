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

## Prefer undefined to null

Use `undefined` for an absent value in backend application code, optional
properties, and function results. Prefer optional properties (`property?: T`)
when omission is the intended meaning. Do not introduce `null` as a second
application-level representation of absence without a concrete integration
reason.

Database boundaries are the important exception: PostgreSQL nullable columns
are represented as `T | null` in Kysely table types because PostgreSQL returns
`NULL`. Convert that value to `undefined` as soon as it leaves the database
access layer when the rest of the backend does not need to preserve the SQL
distinction. Non-null database columns should remain non-null in both the
schema and their TypeScript types.
