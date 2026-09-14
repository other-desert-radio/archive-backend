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

## Handoff for the next agent

As of 2026-09-11, Phases 0–2 are implemented. The latest completed work is
committed as `4947763` (`finish auth implementation!`). The current runtime
boundary is:

- `src/server.ts` imports the configured Better Auth instance and passes it to
  `buildApp(auth)`.
- `src/app.ts` requires an auth instance and always registers `/api/auth/*` and
  the authenticated admin routes.
- `src/admin/admin.ts` protects both `/admin` and `/api/admin/*` with a Better
  Auth session and the server-owned `admin` role. Missing sessions return `401`;
  authenticated non-admin users return `403`.
- `/health` remains public. `/api/admin` is still a boundary placeholder, and
  `/admin` now serves the authenticated empty React/Vite shell from the
  production bundle in `dist/admin`.
- `0007_create_better_auth_tables` and `0008_add_better_auth_user_role` are
  applied to the local PostgreSQL database. Migrations are not applied
  automatically in other environments.
- `.env` contains local mock values and is ignored by Git. Do not commit real
  secrets. `.env.example` contains the required Better Auth variables.

The last full verification passed: 9 tests, TypeScript checking, Biome,
Markdownlint, and `git diff --check`. The configured auth tests cover sign-in
request validation, no-session lookup, and sign-out without a session; they do
not yet verify a successful credential sign-in with a seeded account.

As of 2026-09-14, the read-only DJ and Shows resource views are implemented. The
shared Figma-inspired shell, Shows/DJs hash navigation, loader/page/component
directory structure, and `DatabaseTableView` wrapper are also implemented. Tags
and Upload remain deferred. Archive resources remain read-only.

### Current implementation inventory

- `src/admin-ui/main.tsx` is only the React entry point.
- `src/admin-ui/pages/` contains `AdminPage`, `DJsPage`, and `ShowsPage`.
- `src/admin-ui/loaders/` contains the DJ and Shows API loaders.
- `src/admin-ui/components/database-table-view.tsx` provides the shared
  `DatabaseTableView`, which owns the required header/body structure and
  loading, error, retry, and empty states for each resource view.
- `src/admin-ui/components/tables/` contains the Shows and DJs tables.
- `#shows` is the default route, `#djs` selects the DJ view, and `#tags` selects
  the Tags view. Upload remains a visible sidebar placeholder.
- `src/admin-ui/assets/background/README.md` marks the future background-asset
  location; the current background is gray.

### Next-agent checklist

Implement one item at a time and stop for review after each item:

1. Add authenticated `GET /api/admin/tags` using `transformTags`, with focused
   success and database-error route tests and documentation.
2. Add `loadTags` under `src/admin-ui/loaders/`, `TagsPage` under
   `src/admin-ui/pages/`, and `TagsTable` under
   `src/admin-ui/components/tables/`. Reuse `DatabaseTableView`, `Header`, and
   `Body`; include loading, empty, and error states plus loader tests.
3. [x] Connect the Tags sidebar item to `#tags` and verify Shows, DJs, and Tags
       navigation without adding CRUD behavior.
4. When the background asset is ready, place it under
   `src/admin-ui/assets/background/` and replace only the gray background in a
   separate visual review chunk.

Do not begin relationships, mutations, upload, filtering, or authentication
changes as part of these resource-view chunks.

### Admin UI visual and navigation rules

The supplied Figma management sketch establishes the shared shell used by the
resource tables:

- Use a black, full-width 49px top bar with centered
  `OTHER DESERT RADIO / MANAGEMENT` text.
- Use a black 172px left sidebar below the top bar, with `DATABASE` entries for
  shows, DJs, and tags, plus a `UTILS` entry for upload.
- Render the active resource in bold. Shows is active for the Shows slice; DJs
  remains reachable, while Tags and Upload remain deferred until implemented.
- Use a monospace font stack and a gray page/content background for now.
- Keep the eventual background asset in `src/admin-ui/assets/background/`; do
  not add the texture asset until it is available.
- Keep the layout usable on narrow screens by allowing the sidebar to flow above
  the content and the tables to scroll horizontally.
- Keep UI data loaders in `src/admin-ui/loaders/`, resource pages in
  `src/admin-ui/pages/`, and table components in
  `src/admin-ui/components/tables/`.
- Wrap each database resource page with the shared `DatabaseTableView`, using
  its `title`, loading/error/retry, and empty-state props. The component renders
  the resource heading and body and only renders table children after a
  successful non-empty load.

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
- [x] Document the initial boundary and local configuration.
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
- [x] Review the Fastify auth-handler boundary before adding session guards.
- [x] Add Better Auth session validation to both `/admin` and `/api/admin/*`.
- [x] Add sign-in, sign-out, and configured-instance session coverage.
- [x] Add the single admin role with multiple accounts and sign-up disabled.
- [x] Enforce the single admin role and remove the temporary test fallback.
- [x] Add temporary HTTP Basic Auth browser prompting while the admin login UI
      is not yet available.
- [ ] Create the initial admin account through the reviewed setup process and
      verify a successful cookie-backed sign-in.

### Archive resources

- [x] Add the read-only DJ API and its documented response shape.
      `GET /api/admin/djs` returns a top-level array in the format consumed by
      the frontend:

```json
[
  {
    "id": 1,
    "title": "name",
    "bio": "safe html",
    "image": "image_url",
    "shows": [1, 2],
    "tags": [3, 4]
  }
]
```

`image` is omitted when the database value is `NULL`. Show IDs come from
`show_djs`. Tag IDs are the distinct union of direct `dj_tags` entries and tags
assigned to the DJ's shows through `show_tags`. Database errors return
`500 { "error": "Internal Server Error" }`.

- [x] Serve the empty React/Vite shell at `/admin`.
- [x] Render the read-only DJ list with loading, empty, and error states.
- [x] Add the read-only shows API.
- [x] Add the read-only shows UI list as a separate reviewed chunk.
- [x] Add the shared Figma-inspired shell, gray background, and Shows/DJs
      navigation.
- [x] Add the shared `DatabaseTableView` wrapper with `Header` and `Body`.
- [ ] Add a read-only tags API and UI list as separate reviewed chunks.
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
- [x] Return `401 Unauthorized` for protected API requests without access.
- [x] Keep `/health` unchanged.

Stop and request review before adding database reads or frontend code.

### Phase 2: Add real authentication

Use Better Auth with the existing Bun, Fastify, PostgreSQL, and Kysely stack.
Better Auth will own authentication users, sessions, accounts, and verification
records; it will not own archive entities such as DJs, shows, or tags.

The initial configuration uses the existing PostgreSQL pool, enables
email/password authentication, and disables public sign-up. The authentication
handler is mounted under `/api/auth/*`, and the session guard protects both
admin route prefixes. The server-owned `role` field defaults to the sole `admin`
role, and the guard rejects authenticated users without that role.

The generated review-only schema is in
[`BETTER_AUTH_SCHEMA.sql`](BETTER_AUTH_SCHEMA.sql). It defines the four core
Better Auth tables—`user`, `session`, `account`, and `verification`—and their
lookup indexes. Migration `0007_create_better_auth_tables` transcribes this
reviewed schema into the repository's Kysely migration format and has been
explicitly applied to PostgreSQL.

The schema was generated and reviewed before it was transcribed into the
repository migration. Authentication setup must not silently modify the
database; preserve the existing one-migration-at-a-time workflow.

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
Fastify authorization hook. The current hook requires an authenticated session
and the `admin` role on both admin route prefixes. Do not use the Better Auth
Admin plugin for archive CRUD; that plugin is only for managing authentication
users and roles.

Do not add archive CRUD behavior in this phase. Review cookie settings, secret
management, session expiry, authentication schema, and deployment assumptions
before continuing.

### Phase 3: Add the first read-only API — complete

Implement only `GET /api/admin/djs`:

- Select the DJ columns through Kysely.
- Return a documented response shape.
- Add basic error handling and a focused route test.
- Do not add create, update, delete, filtering, or relationship endpoints yet.

The DJ endpoint is implemented and covered by focused success and database error
tests.

### Phase 4: Serve the empty admin shell

Add the React/Vite build and serve it from Fastify at `/admin`:

- [x] Build a minimal React/Vite application shell.
- [x] Configure the container image to build and include the production bundle.
- [x] Keep the shell behind the same authentication boundary.
- [x] Do not add data tables yet.

Pause for review after the authenticated shell loads.

### Phase 5: Render the DJ list

Add one read-only DJ table in the admin UI:

- [x] Connect the table to `GET /api/admin/djs`.
- [x] Render the DJ ID, title, bio, and image fields.
- [x] Add loading, empty, and error states.
- [x] Add focused frontend data-loader coverage. The bio is displayed as escaped
      text until the later sanitization phase is implemented.

Do not add editing or deletion until the list is reviewed.

### Phase 6: Render read-only shows and tags — in progress

Add the remaining archive resources as read-only views only:

1. read-only shows endpoint and UI list — complete;
2. read-only tags endpoint;
3. read-only tags UI list;

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
