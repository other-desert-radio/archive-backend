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

## Next action

Await review of completed chunk 1, then implement chunk 2 as one checkpoint. The
reader returns `MixcloudConfig | undefined`; the encryption key uses canonical
base64 encoding of 32 bytes. Wire configuration into startup when integrating
the provider/routes, after completing local credentials. No OAuth dependency or
routes have been added yet.
