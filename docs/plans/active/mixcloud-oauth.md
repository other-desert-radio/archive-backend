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
- [x] 4. Protected routes: connect, callback, status, disconnect; session/origin
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

## Route review checkpoints

- [x] User reviewed connect + status and requested callback/disconnect.
- [x] Callback + disconnect with sensitive-URL log redaction; awaiting review.

Connect/status live beneath the shared admin session/origin boundary. Connect
resolves user/session IDs from authenticated context, creates an attempt, and
returns a consent URL. Status returns configuration/connection state and account
identity only. Disabled connect returns 503. Unexpected storage errors are
handled inside route handlers so parent error hooks cannot log query parameters.
Responses disable caching.

Startup validates optional Mixcloud configuration and constructs one injected
client/store pair. Partial settings now fail startup; all blank disables the
integration. Regular-database migrations have not been applied. UI wiring is
still pending. Current unit has six route tests covering both roles,
owner/session derivation, states, origin/session guards, secret-free
replies/logs, and storage failures. Existing client/config tests, typecheck,
scoped Biome, docs checks, and Markdown lint pass.

User asked why startup injection and OAuth state are needed. Explained that
injection supports one-time configuration and isolated tests; objects are not
state containers, PostgreSQL is. OAuth random state binds the callback to the
initiating session/attempt. Dependency creation could be moved closer to routes
if desired; no change to the agreed wiring was requested.

## Callback/disconnect verification

Callback reads raw query parameters (preserving duplicates), rejects missing or
ambiguous state, and invokes exchange/identity inside store completion. Fixed
303 redirect outcomes are informational markers for the later UI, which must
reload status. Disabled callback reports unavailable; invalid archive sessions
retain 401/403 from the shared boundary. Disconnect acts on the authenticated
user and requires the existing origin guard. Both use no-store/no-referrer
headers.

Application/admin/origin logs now record request paths without queries using
`requestPathForLog`. Tests capture application output and verify callback
secrets are absent, including unauthenticated callbacks. Route tests cover
success, replay, invalid state/duplicate codes, provider denial/failure,
preservation, disconnect/idempotence, origin/role guards and safe redirects.
Store concurrency and expiry remain covered by the existing isolated PostgreSQL
tests.

Verification passed: 14 Mixcloud route tests, one request-path test, 28 existing
authentication/admin-boundary tests, typecheck, scoped Biome, docs check,
Markdown lint and diff whitespace check. Initial root-log spying targeted the
parent logger instead of its request child; test now captures actual application
log output.

## Upload controls verification

User requested the final UI chunk. Implemented the connection loader and upload
banner controls, response validation, safe consent navigation, connection
identity, disconnect, pending states, callback notices, and reload/retry. Five
loader tests pass. Three Playwright scenarios pass at 1440/390/320px covering
consent navigation, return, identity, keyboard disconnect, cancellation, and
recovery from status errors. Agent-browser screenshots inspected for
disconnected/connected layouts at desktop and phone widths. Browser
authentication and Mixcloud endpoints were mocked; no archive records or
provider accounts were changed. Build/typecheck/lint/docs checks pass. User
review and real-provider smoke test remain outstanding.

## Next action

User reviews completed UI and performs real Mixcloud authorization with
configured credentials. Regular-database migration has not been applied by this
task. Do not mark real-provider validation or user review complete without that
input.
