# Architecture and product boundaries

Read when changing service boundaries, authentication ownership, or deployment.

The backend uses Bun, Fastify, Kysely, and PostgreSQL; the custom admin UI uses
React/Vite, not React-admin. The browser calls authenticated `/api/admin/*`
routes and never accesses PostgreSQL directly. Fastify serves the UI at
`/admin`. The static Astro archive is a separate repository and consumes
exported files.

## Ownership

- `src/app.ts` / `src/server.ts`: registration and startup.
- `src/admin/admin.ts`: shared admin API/UI authorization boundary; `/health` is
  public. [API conventions](api-routes.md#authentication) own route
  authentication rules.
- Better Auth owns users, sessions, accounts, and verification, not archive
  CRUD. Multiple accounts share one server-owned admin role; public sign-up is
  disabled. Do not use the Better Auth Admin plugin for archive resource
  management.
- `src/admin/routes/`: resource APIs with injected database access.
- `src/admin-ui/pages/`: orchestration; components/loaders separate presentation
  and data access. [UI guidance](ADMIN_UI_DESIGN.md) owns those boundaries.
- `src/db/migrations/` and `src/db/types.ts`: actual schema and typed wiring;
  [database guidance](DATABASES.md) explains invariants and migration decisions.
- `src/db/export-archive.ts`: JSON/WebP export with the
  [public asset contract](ARCHIVE_EXPORT.md).

## Deployment boundaries

DigitalOcean Droplet hosting and publication to the Astro GitHub Pages
repository are product intent, not a verified deployment runbook. No tracked CI
deployment workflow exists. Inspect `Dockerfile`, `compose.yml`, and
`.env.example` for current runtime configuration; follow
[development operations](DEVELOPMENT.md) for startup, explicit reviewed
migrations, backups, and restores.

Keep secrets outside Git; preserve an existing `.env`, and update `.env.example`
when required variables change. Better Auth requires `BETTER_AUTH_SECRET` and
`BETTER_AUTH_URL`. Review secure, HTTP-only, same-site cookies, expiry, HTTPS,
and server-side authorization when preparing production authentication.
Temporary Basic Auth defaults are local development only.

The initial architecture intentionally uses application authentication without
requiring an additional VPN, private network, proxy allowlist, or identity
provider. Adding one is a separate architectural decision.

## Deferred product ideas

The former implementation plans included admin account provisioning and
successful cookie sign-in verification; audio upload limits/storage, Mixcloud
publishing, job status/retry, optional FFMPEG and tracklist editing; automated
GitHub Actions publication; CSRF, rate limits, security headers, durable audit
logging, and server pagination/filtering. These are candidates to assess against
current code, not an approved work queue or evidence that each remains absent.
Rich-text B/I controls and matching-text highlighting were optional UI ideas.
Preserve the plain-text-to-safe-HTML boundary; do not introduce arbitrary raw
HTML editing. Original product intent remains in
[human notes](../human_docs/features.md).
