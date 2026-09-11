# Archive Backend Agent Notes

## Current status

This is a minimal TypeScript backend using Bun, Fastify, Kysely, and PostgreSQL.
The server exposes `GET /health` and checks PostgreSQL connectivity during startup.
The first three Kysely migrations create the `djs`, `shows`, and `tags` tables.
The remaining relationship tables will be added one migration at a time for
review.

Biome is the formatter and linter for source files. The checked-in `biome.json`
is the source of truth for those lint and formatting rules. Markdown is linted
with markdownlint-cli2.

TypeScript-specific conventions, including the preference for `type` aliases
and `undefined` over `null`, are documented in
[`TYPESCRIPT.md`](TYPESCRIPT.md).

## Containers

Docker Compose runs two services:

- `api` builds from the Bun-based `Dockerfile` and listens on port `3000`.
- `postgres` runs PostgreSQL 16 on port `5432`.

PostgreSQL uses the named `archive_postgres_data` volume, so its data persists
across container rebuilds. Migrations are not applied automatically when the
API starts.

Copy `.env.example` to `.env` before starting the stack. Compose reads the
PostgreSQL name, user, password, and host port from `.env`, then constructs the
API container's internal `DATABASE_URL` using the `postgres` service hostname.
For commands run locally, the backend constructs the connection URL from those
same `POSTGRES_*` variables and defaults the host to `localhost`. A supplied
`DATABASE_URL` takes precedence. The `.env` file is ignored by Git.

## Commands

- `bun install` installs dependencies.
- `bun run dev` starts the server with Bun watch mode.
- `bun run start` starts the server once.
- `bun run db:migrate` applies one pending migration.
- `bun run db:rollback` rolls back one migration.
- `bun run format` formats supported files with Biome.
- `bun run typecheck` runs TypeScript validation.
- `bun run lint` runs Biome and Markdown checks.
- `bun run setup-hooks` configures the tracked Git pre-commit hook.
- `scripts/build-container` rebuilds and starts the Docker Compose stack in the
  background.

After setup, every commit runs `bun run format` followed by `bun run lint`
through `.githooks/pre-commit`.

Start the stack with `cp .env.example .env` followed by
`scripts/build-container`. Then run `scripts/migrate up` once, review the
result, and check the API with `curl http://localhost:3000/health`. Repeat the
migration command after each review checkpoint; `scripts/build-container` does
not apply migrations.

## Conventions

- Keep the backend small until a concrete feature requires more structure.
- Use Kysely for database access and migrations.
- Apply one migration at a time and pause for review before continuing.
- Keep `.env` local and untracked. Update `.env.example` when required
  variables change.
- Update this document in the same change whenever the project behavior or
  workflow changes.
