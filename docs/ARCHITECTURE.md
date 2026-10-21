# Architecture and product boundaries

Read when changing service boundaries, authentication ownership, or deployment.

The backend uses Bun, Fastify, Kysely, and PostgreSQL; the custom admin UI uses
React/Vite, not React-admin. The browser calls authenticated `/api/admin/*`
routes and never accesses PostgreSQL directly. Fastify serves the UI at
`/admin`. The static Astro archive is a separate repository and consumes
exported files.

## Ownership

- `src/app.ts` / `src/server.ts`: registration and startup.
- `src/admin/admin.ts`: shared archive API authorization boundary; the UI shell
  is public; `/health` is public.
  [API conventions](api-routes.md#authentication) own route authentication
  rules.
- Better Auth owns users, sessions, accounts, and verification, not archive
  CRUD. Accounts have admin/editor roles; both manage archive resources, while
  only admins manage accounts and publish the archive. Public sign-up is
  disabled. The Admin plugin is used by trusted server code for account
  management; its browser routes are blocked.
- `src/admin/routes/`: resource APIs with injected database access.
- `src/admin-ui/pages/`: orchestration; components/loaders separate presentation
  and data access. [UI guidance](ADMIN_UI_DESIGN.md) owns those boundaries.
- `src/db/migrations/` and `src/db/types.ts`: actual schema and typed wiring;
  [database guidance](DATABASES.md) explains invariants and migration decisions.
- `src/publication/`: durable jobs, revision snapshots, advisory-lock ownership,
  safe Git publication/recovery, and notifications. Jobs continue independently
  of browser connections. Credentials belong to the runtime, outside the image.
- `src/publication/git/`: command safeguards, checkout validation, remote
  synchronization, generated-file commit/push, and interrupted-job recovery in
  separate modules. Its index exports the runner-facing operations; internal
  modules import each other directly to avoid barrel cycles.
- `src/db/export-archive.ts`: JSON/WebP export with the
  [public asset contract](ARCHIVE_EXPORT.md).

## Deployment boundaries

The API exports generated assets into a configured archive-site checkout. Local
mode writes assets with read-only Git metadata inspection; remote mode uses a
dedicated checkout and pushes recognized publisher commits without force.
PostgreSQL stores revisions, jobs, stages, and bounded logs. An advisory lock
serializes publication, and an authenticated event stream lets admins reconnect
to durable state. A pushed commit is the success boundary; the separate
archive-site Pages workflow deploys only `main`. Remote development publication
defaults to `publish-dev`; local mode leaves the actual checked-out branch
unchanged.

Inspect `Dockerfile`, `compose.yml`, `compose.remote.yml`, and `.env.example`
for runtime configuration. Use the manual
[server installation guide](SERVER_INSTALL.md) for host setup. Follow
[development operations](DEVELOPMENT.md) for startup, explicit reviewed
migrations, backups, restores, and publication SSH setup. The container installs
Git/SSH but mounts a dedicated write deploy key and verified host keys at
runtime; neither credentials nor checkout contents are baked into the image. The
API runs as a non-root service account whose numeric UID/GID match the host
checkout owner; development uses the developer’s IDs and servers use a dedicated
service account. SSH mounts live under `/run/archive-ssh`.

Keep secrets outside Git; preserve an existing `.env`, and update `.env.example`
when required variables change. Better Auth requires `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL`. Review secure, HTTP-only, same-site cookies, expiry, HTTPS,
and server-side authorization when preparing production authentication. Browser
login uses database-backed, seven-day cookie sessions; Basic Auth is removed.
HTTPS enables secure cookies. Origin checks and database-backed rate limits
protect authentication and account mutations.

The initial architecture intentionally uses application authentication without
requiring an additional VPN, private network, proxy allowlist, or identity
provider. Adding one is a separate architectural decision.

## Deferred product ideas

The former implementation plans included audio upload limits/storage, Mixcloud
publishing, job status/retry, optional FFMPEG and tracklist editing; automated
GitHub Actions publication; security headers, durable audit logging, and server
pagination/filtering. These are candidates to assess against current code, not
an approved work queue or evidence that each remains absent. Rich-text B/I
controls and matching-text highlighting were optional UI ideas. Preserve the
plain-text-to-safe-HTML boundary; do not introduce arbitrary raw HTML editing.
Original product intent remains in [human notes](../human_docs/features.md).
