# Archive Backend Agent Notes

## Current status

This is a minimal TypeScript backend using Bun, Fastify, Kysely, and PostgreSQL.
The server exposes `GET /health` and checks PostgreSQL connectivity during
startup. The first six Kysely migrations create the `djs`, `shows`, `tags`,
`show_djs`, `show_tags`, and `dj_tags` tables.

They were added one migration at a time for review.

The seventh migration contains the reviewed Better Auth tables, and the eighth
migration adds the server-owned admin role. Migration nine renames the tags
table's name column to title to match the archive field contract. Migration ten
adds the nullable `djs.socials` field, and migration twelve adds the non-null
`tags.reviewed` flag. Migration thirteen replaces the nullable DJ image URL with
raw binary image storage and filename metadata. Migration fourteen adds nullable
DJ show metadata. Migration fifteen adds and backfills paired 400px and 1024px
WebP DJ images. Migration sixteen removes the transitional original DJ image
bytes and filename metadata. Migration seventeen adds optional
`tags.mixcloud_key` and `tags.mixcloud_url` source metadata. Migrations are
applied explicitly, one at a time, after review.

Biome is the formatter and linter for source files. The checked-in `biome.json`
is the source of truth for those lint and formatting rules. Markdown is
formatted with Prettier and linted with markdownlint-cli2. The checked-in
`.markdownlint-cli2.yaml` disables MD024, so documents may use multiple headings
with the same text.

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

The existing `modify-tag` endpoint additionally supports review-only
`{ id, reviewed: boolean }` updates. These preserve metadata and relationships;
full metadata saves continue to mark reviewed. Mixed payloads are rejected. The
Tags table inline review control is the next separate chunk, pending review.

Tag editing API chunk is complete: `POST /api/admin/modify-tag` validates and
replaces title, hex color, and optional Mixcloud metadata, marks reviewed, and
preserves identity, creation timestamp, and DJ/Show links. Conflicting
normalized titles are rejected. Tag IDs use the same positive safe-integer
validation as Show editing. The Tags table Edit action opens a prefilled
shared-modal editor with hex input, a native color picker, and a live inline
chip. Saving marks reviewed and reloads Tags; failed saves retain values. The “+
tag” action now opens onboarding with the same validated fields and color
preview. New tags are reviewed; existing titles reuse the current tag.
Successful creation refreshes Tags and clears search. Merging, deletion, and
grid views remain outside this workflow.

For UI implementation and review, read the
[admin UI design and reuse guide](ADMIN_UI_DESIGN.md). It documents the reviewed
modal aesthetic, spacing, reusable components, interaction defaults, and future
design ideas.

The first Show UI implementation chunk is complete. DJs use reusable resource
toolbar, table, state-view, and onboarding primitives. The shared onboarding
shell traps focus, returns focus to its opener, supports Escape dismissal while
idle, prevents duplicate submission, and keeps its content scrollable within the
available viewport. Tag drafts commit on blur before chip-removal clicks, so
removed selections stay removed. Moving focus to Submit/Save preserves the draft
until submission, avoiding layout shifts that could swallow the click; request
builders include the draft. DJ and Show forms use the shared tag chip and
autocomplete field. The legacy comma-separated tags field ignores stale
validation responses; a validation-service failure does not prevent final
submission. Chunk 2 migrates the read-only Shows table to the same resource
view, with search and sorting. Show onboarding uses the shared modal, date-only
and integer-seconds duration inputs, a searchable existing-DJ selector, optional
image URL and tags, and a transactional JSON creation endpoint.

DJ onboarding accepts and decodes JPEG, PNG, and WebP uploads before opening a
layered square crop modal. The modal supports drag positioning, zoom, and
left/right 90-degree rotation, then sends a 1200-by-1200 WebP crop through the
DJ multipart upload field. Sharp creates and stores 400-by-400 and 1024-by-1024
WebP variants; the submitted crop is not retained.

The DJs and Shows toolbars support table and grid views. DJ cards render their
available image, title, and colored tags; Show cards also render linked DJ
names. Both include clear image/relationship fallbacks and a square, bordered
placeholder Edit control for the future edit workflow.

Phases 0–4 of the admin plan are implemented. `/api/admin` still returns a
boundary status object and `/admin` serves the authenticated empty React/Vite
shell. The production container builds the shell into `dist/admin`; a missing
bundle returns `503`. `GET /api/admin/djs` returns a top-level DJ array with
`id`, `createdAt`, `title`, `bio`, optional `image_small` and `image_large`,
`socials`, `showTitle`, and `showDescription`, `shows`, and `tags`; its
relationship IDs are derived from the relationship tables. The admin-only
`directTags` array identifies the directly assigned subset of the combined
`tags` list, whose other entries may be inherited through linked shows.
`POST /api/admin/create-dj` creates DJs transactionally and sanitizes
bio/socials HTML. `POST /api/admin/modify-dj` transactionally replaces a DJ's
editable metadata and direct tags, and can preserve, replace, or remove the
paired image variants. Tag creation is centralized in the Tags module and is
available through `POST /api/admin/create-tag` and
`POST /api/admin/create-tags`; automatically colored tags are unreviewed, while
explicitly colored tags are reviewed. The UI renders the DJ list with loading,
empty, and error states. The Shows API returns transformed relationship IDs plus
its admin-only `createdAt` timestamp; `POST /api/admin/create-show` validates
and atomically persists Shows, existing-DJ links, and reused or newly created
tags. `POST /api/admin/modify-show` shares creation validation and persistence,
replacing Show metadata and relationships atomically while preserving identity
and creation timestamp. Both Shows table and grid Edit controls open a prefilled
editor that shares creation fields and modal behavior. Saving updates metadata,
linked DJs, and tags; an unresolved existing tag blocks saving until retry
succeeds. Public archive response contracts remain unchanged.

For detailed runtime state, migration status, verification results, and known
test gaps, see the
[admin plan handoff](ADMIN_UI_PLAN.md#handoff-for-the-next-agent).

For real-database feature verification that must not alter the normal local
archive dataset, use the
[isolated database end-to-end testing runbook](DATABASE_E2E_TESTING.md).

## Commands

- `bun install` installs dependencies.
- `bun run dev` starts the server with Bun watch mode.
- `bun run start` starts the server once.

- `bun run test` builds the admin bundle and runs the Bun suite in `tests/`.
  Playwright files in `integration-tests/` run through the separate integration
  runner.
- `./scripts/run-integration-tests` builds and runs the DJ and Show editing
  suites in a disposable Docker Compose stack. It uses its own Postgres volume
  and API; the test data and containers are removed when the command finishes.
  `bun run test:integration` is an equivalent package-script shortcut.
- `bun run auth:generate` regenerates the review-only Better Auth schema.
- `bun run db:migrate` applies one pending migration.
- `bun run db:migrate:all` applies all pending migrations.
- `bun run db:rollback` rolls back one migration.
- `bun run db:seed:djs` inserts five standalone dummy DJs.
- `bun run db:seed:shows` inserts five standalone dummy shows.
- `bun run db:delete:shows -- --confirm` permanently deletes all shows and their
  cascading relationship rows.
- `bun run db:export:archive` writes DJ detail/index JSON, the top-level show
  index, and tags to the configured Astro `src/res/` directory, and stored DJ
  WebP variants to `public/assets/djs/`. It logs each build stage and generated
  file.
- `bun run db:delete:djs -- --confirm` permanently deletes all DJs and their
  cascading relationship rows.
- `bun run format` formats source files with Biome and Markdown files with
  Prettier.
- `bun run typecheck` runs TypeScript validation.
- `bun run lint` runs Biome and Markdown checks.
- `bun run setup-hooks` configures the tracked Git pre-commit hook.

- `scripts/build-container` rebuilds and starts the Docker Compose stack in the
  background.
- `scripts/build-container-watch` rebuilds and starts the Docker Compose stack,
  then runs the Vite build watcher. The host `dist/admin` directory is mounted
  into the API container, so `/admin` updates after each frontend rebuild. Stop
  the watcher with `Ctrl-C`; stop the containers separately with
  `docker compose down`.

The archive exporter writes JSON to the absolute `ARCHIVE_RESOURCE_DIRECTORY`
constant and images to `ARCHIVE_ASSET_DIRECTORY` in `src/db/export-archive.ts`.
They default to the Astro frontend's `src/res/` and `public/assets/`
directories. A later, separate GitHub publication feature will copy these assets
to the frontend repository; it will not write to this backend's `dist/`
directory.

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

For admin UI work, use `scripts/build-container-watch` after the initial
database setup. Open the authenticated `/admin` page and leave the watcher
running while editing `src/admin-ui/`.

### Modal component organization

DJ create/edit orchestration lives under `dj/onboarding-modal/`, with separate
components for shared metadata fields and edit image controls. Tag option
loading uses the shared `useTagOptions` hook; decoding, crop candidates, and
image removal use `useDJImageSelection` under `dj/image/`. Both hooks ignore
obsolete asynchronous results after closure. The form shell and generic message
modal share `useDialogFocus` for initial focus, Tab containment, and Escape
handling. Resource validation and request building remain in their existing
private utilities, and public DJ imports continue through the `dj` barrel.

### Modal sizing and typography

Shared form and message panels use the inherited Space Mono font, body text of
at least 14px, and 12px helper text. Modal sizing tokens standardize 32px
desktop and 20px phone padding, 20px field gaps, 28px title-to-form spacing, and
control heights of at least 42px. Text inputs, tag boxes, and DJ search share
consistent padding and square black borders. Submit and Cancel retain their
compact 10px gap and reviewed hover treatment.

### Modal field layout

Desktop forms keep their label/control columns, with textarea, tag, and DJ
selection labels aligned to the top of their controls. At widths of 450px or
less, each field stacks its label above its control with an 8px gap. Fields
retain the shared 20px spacing, and helper text stays attached to its own
control. Inherited DJ tags follow the same single-column phone layout.

### Show duration input

Show creation uses one required duration field in seconds, with a minimum of 1
and step of 1. Blank, zero, negative, fractional, non-finite, and values above
2,147,483,647 (the existing API limit) are rejected. The existing API duration
remains a number of seconds; no backend or database changes are needed. Duration
changes participate in the shared unsaved-changes confirmation.

### Modal cancellation

Cancel, Close, Escape, and clicks directly on the shared modal backdrop close
unchanged forms immediately. Forms with unsaved values show a discard
confirmation; Keep editing, Escape, or its backdrop preserves the form. Discard
changes closes it. Reverting values clears the warning, including image removal
undo and relationship selections. Tag drafts count as changes. Confirmation
traps focus and makes the underlying form inert; dismissal remains blocked
during submission and while the DJ crop dialog is open. Successful saves close
directly.

### Visual admin UI verification

The shared DJ create/edit and Show create modal uses a larger cross close
control, bold Cancel and thicker close strokes on hover, and a bordered submit
button that moves 4px up and left with a black shadow on hover. Disabled
controls do not apply these hover states; reduced-motion preferences disable the
submit transition. The close control has a gray hover background, and Submit and
Cancel use a compact vertical gap. Opening the modal focuses its panel. Buttons
across the admin UI show focus outlines for keyboard navigation rather than
mouse clicks.

Use `agent-browser` as the required acceptance check for admin UI changes. With
the local stack running, open the affected authenticated resource view using the
documented local development credentials, wait for rendering to settle, then
inspect its accessibility snapshot or save a screenshot for visual review.
Interact with the changed control when the behavior is interactive:

```sh
agent-browser --session admin-ui-verify set credentials admin admin
agent-browser --session admin-ui-verify open http://localhost:3000/admin/#djs
agent-browser --session admin-ui-verify wait 500
agent-browser --session admin-ui-verify snapshot -i
agent-browser --session admin-ui-verify screenshot /tmp/admin-djs.png
```

The browser CLI stores its session socket outside the workspace sandbox, so an
agent may need to request the approved elevated permission for these local,
read-only inspection commands. Use `#shows` and `#tags` to check the other
resource views. Do not embed the local credentials in the URL: this version of
`agent-browser` preserves them in the document URL, which makes relative admin
API fetches fail. Set credentials on the session first, then open the
credential-free local URL. Do not use the local credentials outside local
development.

## Conventions

- The admin UI uses the archive site's Space Mono font throughout, including
  form controls. Regular, italic, bold, and bold italic WOFF2 files and their
  license live in `src/admin-ui/assets/fonts/`, alongside the background assets.
- Keep the backend small until a concrete feature requires more structure.
- Organize admin UI components by responsibility. Shared primitives use
  `components/shared/resource-views/` or `components/shared/modal/`, with each
  primitive in its own subdirectory; resource-specific components follow the
  same pattern under `components/dj/` and `components/shows/`. DJ image
  components live under `components/dj/image/`. Every component directory
  exposes an `index.ts` barrel; public imports use the highest relevant group
  barrel. `components/dj/image/index.ts` re-exports all image child folders.
- Use Kysely for database access and migrations.
- Seed data should be added with an explicit script and should not run during
  application startup.
- Run `bun run format` after every small implementation chunk, before handing
  the chunk off for review.
- Apply one migration at a time and pause for review before continuing.
- Keep `.env` local and untracked. Update `.env.example` when required variables
  change.
- Update this document in the same change whenever the project behavior or
  workflow changes.
