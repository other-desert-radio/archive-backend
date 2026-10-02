# Archive Backend Agent Guide

Use this file to find implementation guidance and local development commands.
The root [README](../README.md) is the human-written GitHub introduction; keep
agent workflow notes here or in the relevant focused document.

## Sources of truth

Read [AGENTS.md](../AGENTS.md) before changing the repository. Implement one
small feature with documentation and focused verification, then stop for review.

| Work                                                                       | Guidance                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| TypeScript conventions                                                     | [TYPESCRIPT.md](TYPESCRIPT.md)                         |
| Admin UI components, styling, interactions, and visual checks              | [ADMIN_UI_DESIGN.md](ADMIN_UI_DESIGN.md)               |
| API authentication, resource layout, shared types, validation, and logging | [api-routes.md](api-routes.md)                         |
| Database schema, relationships, migrations, and Mixcloud tracking          | [DATABASES.md](DATABASES.md)                           |
| Isolated database and browser integration testing                          | [DATABASE_E2E_TESTING.md](DATABASE_E2E_TESTING.md)     |
| Human database intent and planned importer behavior                        | [databases_human.md](../human_docs/databases_human.md) |

Use source code to confirm current behavior. The implementation plans in this
folder record earlier decisions and handoffs; their phase status and runtime
observations are historical, not proof of the current implementation or local
migration state. Avoid duplicating API contracts or UI specifications here.

## Repository map and current capabilities

The backend uses Bun, Fastify, Kysely, and PostgreSQL; the admin UI uses React
and Vite. Useful entry points:

- `src/app.ts` and `src/server.ts`: application registration and startup.
- `src/admin/admin.ts`: authenticated API/UI boundary and resource registration.
- `src/admin/routes/`: resource route folders, types, and barrel exports.
- `src/admin-ui/pages/` and `src/admin-ui/components/`: resource orchestration
  and shared/resource-specific presentation.
- `src/db/types.ts` and `src/db/migrations/`: typed database schema and
  migrations.
- `src/db/export-archive.ts`: archive JSON and image export.
- `tests/` and `integration-tests/`: Bun and Playwright verification.

The admin UI supports DJ and Show table/grid views, creation, and editing. Tags
have a table, creation, metadata editing, and inline review. Mixcloud Import is
read-only: its table lists tracking records and linked Show/DJ/tag details.
Migration `0018_create_mixcloud_import_table` creates its backing table; apply
it explicitly before expecting that view to load.

The WIP Mixcloud importer and its launcher remain on `mixcloud-import` and are
excluded from this branch. `scripts/fetch-mixcloud` is available and writes the
combined public cloudcast export to ignored `src/res/mixcloud.json`; it does not
import records into PostgreSQL.

## Local environment and startup

Run commands from the repository root. Copy `.env.example` to `.env` only if a
local file does not already exist, then configure its values. Keep `.env`
untracked; update `.env.example` when introducing required variables.

Compose runs the API and PostgreSQL 16. Ports come from `PORT` and
`POSTGRES_PORT` (normally 3000 and 5432). Database data persists in
`archive_postgres_data`; container rebuilds do not apply migrations.

The API container uses the `postgres` service hostname. Host commands use
`DATABASE_URL` when supplied; otherwise `src/db/db.ts` constructs a URL from
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, optional `POSTGRES_HOST`
(default `localhost`), and optional `POSTGRES_PORT` (default `5432`).

```sh
bun install
scripts/build-container
# After reviewing the pending migration, apply one step:
scripts/migrate up
curl http://localhost:3000/health
```

Repeat migration steps after each review checkpoint. Use
`scripts/run-migrations` only when all pending migrations have been reviewed.
Startup checks PostgreSQL connectivity; `/health` is public.

Tag editing API chunk is complete: `POST /api/admin/modify-tag` validates and
replaces title, hex color, and optional Mixcloud metadata, marks reviewed, and
preserves identity, creation timestamp, and DJ/Show links. Conflicting
normalized titles are rejected. Tag IDs use the same positive safe-integer
validation as Show editing. The Tags table Edit action opens a prefilled
shared-modal editor with hex input, a native color picker, and a live inline
chip. Saving marks reviewed and reloads Tags; failed saves retain values. The “+
tag” action now opens onboarding with the same validated fields and color
preview. New tags are reviewed; existing titles reuse the current tag.
Successful creation refreshes Tags and clears search. Merging and grid views
remain outside this workflow.

For UI development, run `scripts/build-container-watch` after database setup. It
builds the stack, mounts host `dist/admin` into the API container, and starts
the Vite build watcher. Changes appear after each rebuild. Stop the watcher with
Ctrl-C; stop containers separately with `docker compose down`.

## Authentication and UI verification

`/admin` and `/api/admin/*` require an admin session or configured temporary
Basic Auth. Missing credentials return 401; authenticated non-admin sessions
return 403. Local Basic Auth defaults in `.env.example` are `admin` / `admin`;
use those only for local development.

Better Auth requires `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, serves
`/api/auth/*`, disables public sign-up, and owns the authentication tables. Keep
secrets outside Git. See [API conventions](api-routes.md) for the boundary.

For admin layout, styling, or interaction changes, `agent-browser` verification
is required. Start the local stack, wait for rendering, inspect a snapshot or
screenshot, and exercise changed controls. Set session credentials before
opening a credential-free URL:

```sh
agent-browser --session admin-ui-verify set credentials admin admin
agent-browser --session admin-ui-verify open http://localhost:3000/admin/#djs
agent-browser --session admin-ui-verify wait 500
agent-browser --session admin-ui-verify snapshot -i
agent-browser --session admin-ui-verify screenshot /tmp/admin-djs.png
```

Use `#shows`, `#tags`, or `#mixcloud` as appropriate. Embedded URL credentials
break relative admin API requests in the documented browser version. The session
socket is outside the workspace sandbox, so elevated permission may be needed.
Report what was verified and any local runtime blocker. See the
[UI guide](ADMIN_UI_DESIGN.md) for responsive and interaction acceptance checks.

## Commands and checks

| Command                                                                       | Purpose                                                             |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `bun run dev` / `bun run start`                                               | Run the API with watch mode / once                                  |
| `bun run admin:build`                                                         | Build the admin bundle into `dist/admin`                            |
| `bun run test`                                                                | Build the admin bundle, then run Bun tests in `tests/`              |
| `bun test tests/path-to-test.ts`                                              | Run a focused Bun test                                              |
| `bun run test:integration`                                                    | Run Playwright suites in a disposable Compose stack                 |
| `bun run format`                                                              | Format source with Biome and Markdown with Prettier                 |
| `bun run lint`                                                                | Check source and Markdown                                           |
| `bun run typecheck`                                                           | Check TypeScript without emitting files                             |
| `bun run setup-hooks`                                                         | Install the tracked pre-commit hook                                 |
| `bun run auth:generate`                                                       | Generate the review-only Better Auth SQL schema                     |
| `bun run db:migrate` / `bun run db:rollback`                                  | Apply / roll back one migration                                     |
| `bun run db:migrate:all`                                                      | Apply all reviewed pending migrations                               |
| `bun run db:seed:djs` / `bun run db:seed:shows`                               | Insert five standalone dummy records; repeated runs add more        |
| `bun run db:delete:djs -- --confirm` / `bun run db:delete:shows -- --confirm` | Permanently delete all records of that resource and cascading links |
| `bun run db:export:archive`                                                   | Write archive JSON and DJ WebP assets to the frontend directories   |
| `scripts/fetch-mixcloud`                                                      | Fetch the public Mixcloud export; requires curl and jq              |

Run formatting, lint, TypeScript checks, and the smallest relevant tests before
handoff. The installed pre-commit hook runs formatting and lint. Biome and
Markdown rules live in `biome.json` and `.markdownlint-cli2.yaml`.

Playwright files are separate from the Bun suite. The integration runner uses
`compose.integration.yml` with project name `archive-backend-integration`, then
removes its containers and test volume. For manual verification, follow the
[isolated database runbook](DATABASE_E2E_TESTING.md); do not create test records
in the normal archive database. The Mixcloud migration test requires an explicit
disposable `MIXCLOUD_MIGRATION_TEST_DATABASE_URL` and otherwise skips.

Verify alignment, horizontal scrolling, grid columns, and sticky controls with
`integration-tests/resource-layout.spec.ts` and agent-browser at desktop,
tablet, and phone widths. The layout suite mocks resource reads and writes no
archive records.

### Tag deletion API

The authenticated Tag hard-deletion API is implemented. The
`GET /api/admin/tags/:id/delete-impact` preview lists linked Shows and affected
DJs, including direct and inherited assignments. `POST /api/admin/remove-tag`
permanently deletes a tag and its cascading assignment rows while preserving
Shows and DJs. See [the route contract](api-routes.md#tag-hard-deletion). The
Tags UI previews affected records before confirmation and retains search and
sort after deletion.

The archive exporter uses absolute `ARCHIVE_RESOURCE_DIRECTORY` and
`ARCHIVE_ASSET_DIRECTORY` constants in `src/db/export-archive.ts`. Inspect them
before exporting: they target the sibling Astro site's `src/res/` and
`public/assets/`, rather than this backend's `dist/`.

## Database backups and restores

Use PostgreSQL tools inside the Compose `postgres` service; no host PostgreSQL
installation is needed. These scripts use that service's configured database and
user:

```sh
scripts/pg-dump backups/archive.dump
# On the destination, configure .env and start PostgreSQL:
docker compose up -d postgres
scripts/pg-import backups/archive.dump --confirm
```

Export creates a custom-format dump containing schema and data, including
images, authentication tables, and migration history. It creates missing
directories, refuses to overwrite an existing backup, and uses private file
permissions. The `backups/` directory is ignored by Git.

Import uses `pg_restore`, replaces matching objects and data, requires
`--confirm`, and rolls back the restore on failure. Unrelated destination
objects remain; prefer a fresh database when moving between machines. Stop the
API and other writers during restore, then restart them afterward. Use
PostgreSQL 16 to match Compose. Roles and server settings are not copied;
restored objects belong to the destination's configured user.
