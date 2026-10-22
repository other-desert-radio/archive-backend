# Mixcloud OAuth

## Decisions

- Chunked development: structure, scaffolding, then implementation for each
  unit; wait for user review before advancing stages or units.
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

- [ ] 1. Environment configuration: four Mixcloud settings, Compose forwarding,
      validation, focused tests, and configuration documentation.
  - [x] Structure: create `src/mixcloud/config.ts` responsibility shell.
  - [x] User structure review and request for scaffolding (`next`).
  - [x] Scaffolding: server-only settings type and pure reader signature.
  - [ ] User scaffolding review.
  - [ ] Implementation and verification.
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
exposing values. No runtime callers are added at structure stage. Implementation
updates `.env`, `.env.example`, and `compose.yml`, adds focused configuration
tests, and updates the existing development reference.

## Next action

Await user scaffolding review before implementing chunk 1. The reader returns
`MixcloudConfig | undefined` and currently throws an explicit unimplemented
error; it has no live callers. The encryption key contract is a base64-encoded
32-byte key. No environment or runtime behavior has changed. Later chunks
receive their own detailed structure review before files or contracts are
introduced.
