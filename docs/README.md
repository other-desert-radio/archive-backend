# Archive Backend Agent Notes

## Current status

This is a minimal TypeScript backend using Bun, Fastify, Kysely, and PostgreSQL.
The server exposes `GET /health` and checks PostgreSQL connectivity during
startup. The first six Kysely migrations create the `djs`, `shows`, `tags`,
`show_djs`, `show_tags`, and `dj_tags` tables.

They were added one migration at a time for review.

The seventh migration contains the reviewed Better Auth tables, and the eighth
migration adds the server-owned admin role. Migration nine renames the tags
table's name column to title to match the archive field contract. The first
eight migrations have been applied locally.

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
when no session is present and `403 Forbidden` when the authenticated user does
not have the `admin` role. Until the admin login page is added, an HTTP Basic
Auth challenge provides the browser's native username/password dialog. Configure
it with `ADMIN_BASIC_USERNAME` and `ADMIN_BASIC_PASSWORD`; the example local
values are `admin` / `admin` and must be changed outside local development. The
application factory requires Better Auth.

The Better Auth configuration also requires `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL`. The secret must be generated and stored outside Git. The
authentication handler is mounted under `/api/auth/*`. The server-owned user
role defaults to `admin`, and public sign-up is disabled. Configured-instance
session and sign-out coverage is included in the authentication tests.

## Handoff

Phases 0–4 of the admin plan are implemented. `/api/admin` still returns a
boundary status object and `/admin` serves the authenticated empty React/Vite
shell. The production container builds the shell into `dist/admin`; a missing
bundle returns `503`. `GET /api/admin/djs` is read-only and returns a top-level
DJ array with `id`, `title`, `bio`, optional `image`, `shows`, and `tags`; its
relationship IDs are derived from the relationship tables. The UI now renders
the read-only DJ list with loading, empty, and error states. The read-only Shows
API is also implemented and returns transformed relationship IDs. DJ bios are
currently escaped as text until the planned sanitization phase. Keep all archive
resources read-only and implement the Shows UI and Tags resource in separate
reviewable chunks.

For detailed runtime state, migration status, verification results, and known
test gaps, see the
[admin plan handoff](ADMIN_UI_PLAN.md#handoff-for-the-next-agent).

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

After the database check succeeds, startup logs the web server address, for
example `Web server running at http://0.0.0.0:3000`.

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
