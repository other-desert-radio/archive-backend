# Mixcloud OAuth

## Decisions

- User requested larger checkpoints: combine structure, scaffolding,
  implementation, and verification within each numbered chunk. Review between
  chunks.
- Better Auth owns archive login. The provider uses `oauth4webapi` with its
  supported custom-fetch hook to adapt Mixcloud token transport.
- Each archive user owns one connection; multiple users may connect the same
  Mixcloud account. Personal and station accounts are both supported.
- Store encrypted tokens server-side. Mixcloud disconnect deletes the connection
  and pending attempts; archive logout preserves the connection.
- Local callback: `http://localhost:43827/api/admin/mixcloud/callback`.
- Use the existing `.env.example`; preserve `.env` values and human-note edits.
- Audio uploading is outside this task.

## Checkpoints

- [x] 1. Environment configuration: four Mixcloud settings, Compose forwarding,
      validation, focused tests, and configuration documentation.
  - [x] Structure: create `src/mixcloud/config.ts` responsibility shell.
  - [x] User structure review and request for scaffolding (`next`).
  - [x] Scaffolding: server-only settings type and pure reader signature.
  - [x] User approved continuing with larger checkpoints.
  - [x] Implementation and verification: seven focused tests, typecheck, scoped
        Biome, documentation checks, and Markdown lint.
- [x] 2. Provider client: OAuth library configuration, token exchange, `/me/`,
      boundary validation, timeouts, safe failures, mocked provider tests.
- [x] 3. Storage: connection migration keyed by archive user, cascading
      deletion, authenticated token encryption, storage functions, session-bound
      authorization attempts with hashed state and ten-minute single-use expiry,
      database tests.
- [ ] 4. Protected routes: connect, callback, status, disconnect; session/origin
      guards, callback validation, failure preservation, serialized disconnect
      and completion, OAuth request-log redaction, backend tests.
- [ ] 5. Upload banner: loader, connection states, sign-in redirect, identity,
      disconnect, safe errors, browser and desktop/mobile visual verification,
      authoritative documentation, real OAuth smoke test when configured.

## Current unit: environment configuration

Settings: `MIXCLOUD_CLIENT_ID`, `MIXCLOUD_CLIENT_SECRET`,
`MIXCLOUD_REDIRECT_URI`, `MIXCLOUD_TOKEN_ENCRYPTION_KEY`. All absent disables
the integration; partial or invalid configuration fails validation without
exposing values. Implemented `.env`, `.env.example`, Compose forwarding,
configuration tests, and development documentation. No runtime callers yet. The
local client ID and callback are populated; unknown secret and encryption key
remain blank. Existing environment values were preserved.

## Provider review checkpoints

The user requested smaller reviews within `client.ts` after the initial provider
implementation was written. Keep the existing implementation unconnected; do not
advance to storage or routes until provider review is complete.

- [x] User reviewed contracts and authorization URL generation.
- [x] User reviewed callback validation and token exchange; four focused tests,
      typecheck, and scoped Biome pass.
- [x] User reviewed identity lookup and advanced to storage.

`oauth4webapi` is installed. Its supported custom-fetch hook adapts the standard
code-grant request to Mixcloud's GET exchange and normalizes token responses.
The library validates callback state/errors and processes the normalized token.
No live routes or startup wiring have been added. This supersedes the earlier
conditional choice of `@fastify/oauth2`; update the final provider documentation
once review is complete.

## Storage review checkpoints

User requested: implement tables/migration first, wait for confirmation, then
implement encryption and storage functions.

- [x] Add migration 0034 and Kysely types for connections and OAuth attempts.
- [x] Add isolated PostgreSQL migration test covering constraints, ownership,
      session/user cascades, rollback and reapply; run typecheck and scoped
      lint.
- [x] User reviewed schema/migration and requested encryption/storage.
- [x] Encryption and storage functions implemented and tested; awaiting user
      review.

Connections use user_id as primary key and preserve the connection on session
deletion. Attempts reference (session_id, user_id) together, using a supporting
unique index on session(id, userId). Attempt state is a SHA-256 hex digest;
expiry is bounded to ten minutes. Storage enforces expiry, session ownership,
and atomic single use. No migration applied to the regular archive database.

## Storage verification

Implemented `token-encryption.ts` using Node crypto AES-256-GCM, random nonces,
versioned envelopes, and authenticated owner binding. `store.ts` provides public
identity reads, server-only token reads, attempt creation, serialized
completion, and disconnect. Provider errors consume the attempt but retain any
existing connection. Database failures roll back. Completion holds the user lock
across bounded provider calls so disconnect cannot be undone by a late callback.

Three encryption tests pass, including tampering/wrong key/wrong owner. Five
isolated PostgreSQL store tests pass, including replacement, restart reads,
expiry, ownership, concurrent replay, failed authorization, logout, session
expiry during exchange, and disconnect races. Typecheck, scoped Biome, Markdown
lint, and docs checks pass. Regular archive data and startup remain untouched.

## Next action

Await user review of encryption/storage before starting protected OAuth routes.
Do not wire storage or run migrations on the regular database in this
checkpoint.
