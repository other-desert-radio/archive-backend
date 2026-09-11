# Archive Backend Agent Notes

## Current status

This is a minimal TypeScript backend using Bun, Fastify, Kysely, and PostgreSQL.
The server exposes `GET /health` and checks PostgreSQL connectivity during
startup. The first six Kysely migrations create the `djs`, `shows`, `tags`,
`show_djs`, `show_tags`, and `dj_tags` tables.

They were added one migration at a time for review.

A seventh migration contains the reviewed Better Auth tables and has been
applied.

Biome is the formatter and linter for source files. The checked-in `biome.json`
is the source of truth for those lint and formatting rules. Markdown is
formatted with Prettier and linted with markdownlint-cli2.

TypeScript-specific conventions, including the preference for `type` aliases and
`undefined` over `null`, are documented in [`TYPESCRIPT.md`](TYPESCRIPT.md).

## Containers

Docker Compose runs two services:

- `api` builds from the Bun-based `Dockerfile` and listens on port `3000`.
- `postgres` runs PostgreSQL 16 on port `5432`.

PostgreSQL uses the named `archive_postgres_data` volume, so its data persists
across container rebuilds. Migrations are not applied automatically when the API
starts.

Copy `.env.example` to `.env` before starting the stack. Compose reads the
PostgreSQL name, user, password, and host port from `.env`, then constructs the
API container's internal `DATABASE_URL` using the `postgres` service hostname.
For commands run locally, the backend constructs the connection URL from those
same `POSTGRES_*` variables and defaults the host to `localhost`. A supplied
`DATABASE_URL` takes precedence. The `.env` file is ignored by Git.

The production admin routes require an authenticated Better Auth session.
Requests to `/admin` and `/api/admin/*` are rejected with `401 Unauthorized`
when no session is present. The temporary Phase 1 `ADMIN_LOCAL_TOKEN` bearer
guard remains only as a fallback for tests that build the app without Better
Auth. The application factory requires Better Auth; direct route-plugin tests
are the only callers that use the temporary guard. It is not used by
`src/server.ts`.

The Better Auth configuration also requires `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL`. The secret must be generated and stored outside Git. The
authentication handler is mounted under `/api/auth/*`. The current session
boundary checks authentication but does not yet enforce the single admin role;
role enforcement and configured-instance sign-in/sign-out coverage are the next
authentication tasks.

## Commands

- `bun install` installs dependencies.
- `bun run dev` starts the server with Bun watch mode.
- `bun run start` starts the server once.
- `bun run test` runs the focused Bun test suite.
- `bun run auth:generate` regenerates the review-only Better Auth schema.
- `bun run db:migrate` applies one pending migration.
- `bun run db:migrate:all` applies all pending migrations.
- `bun run db:rollback` rolls back one migration.
- `bun run format` formats source files with Biome and Markdown files with
  Prettier.
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
migration command after each review checkpoint, or run `scripts/run-migrations`
to apply all pending migrations after the schema has been reviewed;
`scripts/build-container` does not apply migrations.

## Conventions

- Keep the backend small until a concrete feature requires more structure.
- Use Kysely for database access and migrations.
- Apply one migration at a time and pause for review before continuing.
- Keep `.env` local and untracked. Update `.env.example` when required variables
  change.
- Update this document in the same change whenever the project behavior or
  workflow changes.
