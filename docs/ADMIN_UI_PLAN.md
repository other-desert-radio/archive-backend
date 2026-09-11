# Admin UI Implementation Plan

## Goal

Build a private admin UI for managing DJs, shows, tags, and their relationships.
The UI will be served by the existing Fastify backend and will use the existing
Kysely and PostgreSQL layers. The public archive frontend and its GitHub-hosted
static JSON workflow remain separate.

The implementation must proceed in small, reviewable chunks. Each chunk should
introduce one narrowly scoped feature, include its tests and documentation, and
stop for user input before the next chunk begins.

## Product context

The product notes in [`human_docs/features.md`](../human_docs/features.md)
describe a DigitalOcean Droplet deployment with two related responsibilities:

- provide a management website for archive data; and
- let an admin upload a show's MP3, publish it to Mixcloud, complete the show
  metadata, and store that metadata in PostgreSQL.

The longer-term workflow may also include FFMPEG parsing and a UI for setting
tracklist start and stop times. Once a show is complete, the backend should
generate the archive JSON and trigger GitHub Actions to publish it to the
archive GitHub Pages repository.

This context does not change the confirmed framework decisions: Fastify, Kysely,
and PostgreSQL remain the backend stack; the admin UI remains a custom
React/Vite application; and Better Auth remains the planned authentication
system. It does add future workflow concerns for upload limits and temporary
file handling, Mixcloud credentials and job status, optional FFMPEG processing,
and GitHub Actions credentials and dispatch behavior. Those concerns must be
planned and implemented as separate reviewable features.

## Target architecture

```text
Browser
  ├── /admin             private React/Vite admin UI
  └── /api/admin/*       private Fastify JSON API
                              │
                              └── Kysely → PostgreSQL
```

The UI should not access PostgreSQL directly. The API must enforce
authentication and authorization independently of the UI.

## Delivery sequence

### Phase 0: Confirm decisions — complete

The initial product and deployment decisions are:

- Use a custom React/Vite UI; do not add React-admin.
- Use Better Auth for authentication and authorization, integrated with Fastify.
- Serve the private admin UI at the exposed `/admin` path.
- Do not add a VPN, private network, reverse-proxy allowlist, or identity
  provider in addition to application authentication for the initial version.
- Support multiple accounts with one admin role.

These decisions are recorded before application implementation begins.

## Granular implementation checklist

### Decisions and foundation

- [x] Confirm the custom React/Vite UI choice.
- [x] Confirm Better Auth as the authentication and authorization system.
- [x] Confirm the `/admin` UI path and `/api/admin/*` API path.
- [x] Confirm multiple accounts with one admin role.
- [x] Record the DigitalOcean, Mixcloud, optional FFMPEG, and GitHub Actions
      workflow context.

### Phase 1: Admin boundary

- [x] Add the admin route/plugin module under `src/admin/`.
- [x] Add protected `/api/admin` and `/admin` route prefixes.
- [x] Add the temporary `ADMIN_LOCAL_TOKEN` bearer-token guard.
- [x] Return `401 Unauthorized` for admin requests without valid access.
- [x] Keep `/health` public and unchanged.
- [x] Add focused route-boundary tests under `tests/admin/`.
- [x] Document the temporary guard and local configuration.
- [x] Review this Phase 1 slice with the user.

### Phase 2: Better Auth

- [x] Add the Better Auth dependency and initial database-backed configuration.
- [x] Generate the review-only schema at `docs/BETTER_AUTH_SCHEMA.sql`.
- [x] Confirm the generated schema contains only Better Auth core tables and
      lookup indexes.
- [x] Review the generated schema and deployment assumptions with the user.
- [x] Add the reviewed authentication migration `0007`, one migration at a time.
- [x] Apply migration `0007` explicitly after migration review.
- [x] Mount the Better Auth handler under `/api/auth/*`.
- [ ] Review the Fastify auth-handler boundary before adding session guards.
- [ ] Add sign-in, sign-out, and session validation.
- [ ] Add the single admin role with multiple accounts and sign-up disabled.
- [ ] Replace the temporary guard on both admin paths.

### Archive resources

- [ ] Add the read-only DJ API and its documented response shape.
- [ ] Serve the empty React/Vite shell at `/admin`.
- [ ] Render the read-only DJ list with loading, empty, and error states.
- [ ] Add a read-only shows API and UI list as a separate reviewed chunk.
- [ ] Add a read-only tags API and UI list as a separate reviewed chunk.
- [ ] Keep DJ, show, and tag resources read-only in the initial release.
- [ ] Defer archive-resource creation, editing, and deletion until explicitly
      approved.

### Relationships

- [ ] Add DJ-to-show assignment.
- [ ] Add tag-to-show assignment.
- [ ] Add tag-to-DJ assignment.
- [ ] Verify each relationship preserves the documented database constraints and
      cascade behavior.

### Audio publishing and archive sync

- [ ] Define upload size, storage lifetime, and failure behavior for show MP3s.
- [ ] Add the show MP3 upload workflow.
- [ ] Add Mixcloud publishing with server-side credential handling.
- [ ] Add publishing status and retry behavior.
- [ ] Decide whether FFMPEG parsing is required for the first release.
- [ ] If needed, add tracklist parsing and start/stop time editing.
- [ ] Finalize show metadata after Mixcloud returns its URL.
- [ ] Generate the archive JSON from PostgreSQL after a completed show.
- [ ] Trigger and verify GitHub Actions publication to the archive repository.

### Hardening and operations

- [ ] Add CSRF protection for cookie-authenticated mutations.
- [ ] Add rate limiting and security headers.
- [ ] Add audit logging for mutations.
- [ ] Add pagination, search, and filtering.
- [ ] Add sanitized handling of DJ bio HTML.
- [ ] Document backup and recovery.
- [ ] Verify HTTPS, secrets, and DigitalOcean deployment behavior.

### Phase 1: Establish the admin boundary

Add only the structural boundary for the private admin area:

- [x] Create an admin route/plugin module.
- [x] Add the `/api/admin` and `/admin` route prefixes.
- [x] Add a temporary, clearly marked bearer-token guard using
      `ADMIN_LOCAL_TOKEN`.
- [x] Return `401 Unauthorized` for protected API requests without access.
- [x] Keep `/health` unchanged.

Stop and request review before adding database reads or frontend code.

### Phase 2: Add real authentication

Use Better Auth with the existing Bun, Fastify, PostgreSQL, and Kysely stack.
Better Auth will own authentication users, sessions, accounts, and verification
records; it will not own archive entities such as DJs, shows, or tags.

The initial configuration uses the existing PostgreSQL pool, enables
email/password authentication, and disables public sign-up. The authentication
handler and session guard remain separate follow-up work.

The generated review-only schema is in
[`BETTER_AUTH_SCHEMA.sql`](BETTER_AUTH_SCHEMA.sql). It defines the four core
Better Auth tables—`user`, `session`, `account`, and `verification`—and their
lookup indexes. It has not been applied and is not a repository migration.

Migration `0007_create_better_auth_tables` transcribes that reviewed schema into
the repository's Kysely migration format. It has been explicitly applied to
PostgreSQL.

Generate Better Auth's PostgreSQL schema and review it before applying it as a
repository migration. Do not allow authentication setup to silently modify the
database, and preserve the existing one-migration-at-a-time workflow.

Add only the minimum needed for:

- admin login;
- admin logout;
- session validation;
- protection of both `/admin` and `/api/admin/*`.

Configure email/password authentication with sign-up disabled. Create the
initial admin account through the reviewed setup process. Use secure, HTTP-only,
same-site cookies and check the authenticated user's admin role on the server
for every protected route.

Mount Better Auth's handler under `/api/auth/*` and use its session API from a
Fastify authorization hook. Do not use the Better Auth Admin plugin for archive
CRUD; that plugin is only for managing authentication users and roles.

Do not add archive CRUD behavior in this phase. Review cookie settings, secret
management, session expiry, authentication schema, and deployment assumptions
before continuing.

### Phase 3: Add the first read-only API

Implement only `GET /api/admin/djs`:

- Select the DJ columns through Kysely.
- Return a documented response shape.
- Add basic error handling and a focused route test.
- Do not add create, update, delete, filtering, or relationship endpoints yet.

Pause for review after this endpoint works.

### Phase 4: Serve the empty admin shell

Add the React/Vite build and serve it from Fastify at `/admin`:

- Build a minimal application shell.
- Verify that the production bundle is included in the container image.
- Keep the shell behind the same authentication boundary.
- Do not add data tables yet.

Pause for review after the authenticated shell loads.

### Phase 5: Render the DJ list

Add one read-only DJ table in the admin UI:

- Connect the table to `GET /api/admin/djs`.
- Render the DJ ID, title, bio, and image fields.
- Add loading, empty, and error states.
- Add focused frontend or browser-level coverage appropriate to the chosen test
  setup.

Do not add editing or deletion until the list is reviewed.

### Phase 6: Render read-only shows and tags

Add the remaining archive resources as read-only views only:

1. read-only shows endpoint;
2. read-only shows UI list;
3. read-only tags endpoint;
4. read-only tags UI list.

Implement each endpoint and UI list as a separate reviewed chunk. Do not add
archive-resource creation, editing, or deletion yet.

### Phase 7: Add relationships

Add relationships one at a time, starting with the smallest useful workflow:

- DJs assigned to a show;
- tags assigned to a show;
- tags assigned to a DJ.

Each relationship feature must preserve the database constraints and cascade
behavior documented in [`DATABASES.md`](DATABASES.md).

### Phase 8: Audio publishing and archive sync

After the read-only archive views are stable, add the audio workflow as separate
chunks:

- define upload size, storage lifetime, and failure behavior;
- upload a show's MP3 and publish it to Mixcloud;
- record the returned Mixcloud URL with the show's metadata;
- decide whether optional FFMPEG parsing and tracklist time editing are needed;
- generate archive JSON and trigger GitHub Actions publication.

Do not combine the upload, publishing, metadata, parsing, export, and GitHub
Actions work into one chunk.

### Phase 9: Hardening and operations

After the feature set is stable, add these as separate reviewable chunks:

- CSRF protection for cookie-authenticated mutations;
- rate limiting and security headers;
- audit logging for mutations;
- pagination, search, and filtering;
- sanitized handling of DJ bio HTML;
- backup and recovery documentation;
- production deployment and private-network verification.

## Rules for every chunk

- Make one small feature or behavior change at a time.
- Read the relevant documentation before changing code.
- Update documentation in the same chunk as any behavior or workflow change.
- Add or update focused tests for the changed behavior.
- Run the smallest relevant verification commands.
- Stop after the chunk is complete and ask the user for review or input.
- Do not infer approval to continue from the original request.
- Do not combine authentication, API resources, UI screens, and deployment
  changes into one large implementation.
