# Mixcloud OAuth

## Decisions

- User requested larger checkpoints: combine structure, scaffolding,
  implementation, and verification within each numbered chunk. Review between
  chunks.
- Better Auth owns archive login; use `@fastify/oauth2` for Mixcloud
  authorization, subject to verification of its compatibility with Mixcloud's
  token response.
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
- [ ] 2. Provider client: OAuth library configuration, token exchange, `/me/`,
      boundary validation, timeouts, safe failures, mocked provider tests.
- [ ] 3. Storage: connection migration keyed by archive user, cascading
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
- [ ] Identity lookup: presented for review; four focused identity/timeout tests
      pass.

`oauth4webapi` is installed. Its supported custom-fetch hook adapts the standard
code-grant request to Mixcloud's GET exchange and normalizes token responses.
The library validates callback state/errors and processes the normalized token.
No live routes or startup wiring have been added. This supersedes the earlier
conditional choice of `@fastify/oauth2`; update the final provider documentation
once review is complete.

## Next action

Await user review of callback validation and exchange, then review identity
lookup. Session ownership, expiry, replay protection, encryption, and
persistence remain in the planned storage/routes units. The client alone does
not enforce them.
