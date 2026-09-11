# Admin UI Implementation Plan

## Goal

Build a private admin UI for managing DJs, shows, tags, and their
relationships. The UI will be served by the existing Fastify backend and will
use the existing Kysely and PostgreSQL layers. The public archive frontend and
its GitHub-hosted static JSON workflow remain separate.

The implementation must proceed in small, reviewable chunks. Each chunk should
introduce one narrowly scoped feature, include its tests and documentation,
and stop for user input before the next chunk begins.

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

### Phase 0: Confirm decisions

Pause for review and confirm:

- React/Vite with React-admin versus a smaller custom React UI.
- Better Auth for authentication and authorization, integrated with Fastify.
- Where the admin UI will be reachable.
- Whether deployment will require a VPN, private network, reverse-proxy
  allowlist, or identity provider in addition to application authentication.
- The initial admin user and role model.

No application code should be added until these decisions are confirmed.

### Phase 1: Establish the admin boundary

Add only the structural boundary for the private admin area:

- Create an admin route/plugin module.
- Add `/api/admin` and `/admin` route prefixes.
- Add a temporary, clearly marked authentication guard or local-only guard.
- Return `401 Unauthorized` for protected API requests without access.
- Keep `/health` unchanged.

Stop and request review before adding database reads or frontend code.

### Phase 2: Add real authentication

Use Better Auth with the existing Bun, Fastify, PostgreSQL, and Kysely stack.
Better Auth will own authentication users, sessions, accounts, and verification
records; it will not own archive entities such as DJs, shows, or tags.

Generate Better Auth's PostgreSQL schema and review it before applying it as a
repository migration. Do not allow authentication setup to silently modify the
database, and preserve the existing one-migration-at-a-time workflow.

Add only the minimum needed for:

- admin login;
- admin logout;
- session validation;
- protection of both `/admin` and `/api/admin/*`.

Configure email/password authentication with sign-up disabled. Create the
initial admin account through the reviewed setup process. Use secure,
HTTP-only, same-site cookies and check the authenticated user's admin role on
the server for every protected route.

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
- Add focused frontend or browser-level coverage appropriate to the chosen
  test setup.

Do not add editing or deletion until the list is reviewed.

### Phase 6: Add DJ creation

Add only the ability to create a DJ:

- Add `POST /api/admin/djs`.
- Validate the request body on the server.
- Add the create form and success/error handling.
- Add tests for valid input and rejected input.

Pause for review before editing or deleting DJs.

### Phase 7: Add DJ editing and deletion

Implement update and delete as separate chunks, one at a time. Each chunk
must include server authorization, validation, database behavior, UI behavior,
and tests. Review after each operation.

### Phase 8: Add shows and tags

Repeat the same sequence for shows and tags:

1. read-only endpoint;
2. read-only UI list;
3. create;
4. update;
5. delete.

Do not implement all three resources in one chunk.

### Phase 9: Add relationships

Add relationships one at a time, starting with the smallest useful workflow:

- DJs assigned to a show;
- tags assigned to a show;
- tags assigned to a DJ.

Each relationship feature must preserve the database constraints and cascade
behavior documented in [`DATABASES.md`](DATABASES.md).

### Phase 10: Hardening and operations

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
