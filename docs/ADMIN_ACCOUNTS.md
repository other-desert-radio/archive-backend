# Administrator accounts

Provision and reset accounts from an interactive terminal on the backend host.
Use the intended database configuration (`DATABASE_URL` or `POSTGRES_*`), and
review/apply pending migrations explicitly before running account commands.
Runtime also requires `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Never rotate
that secret casually: existing sessions rely on it.

```sh
bun run auth:create-admin --email operator@example.org --name 'Operator'
bun run auth:reset-password --email operator@example.org
```

Both commands prompt for a hidden password and confirmation, accepting 8–128
characters. Passwords are not accepted as command arguments or environment
variables. Ctrl-C/Ctrl-D cancels entry. A noninteractive terminal, invalid
input, or mismatched confirmation fails before persistence. Database failures
produce a generic message without printing secrets or SQL. Exit status is
nonzero on failure; success is reported only after commit.

Creation normalizes email case/whitespace, creates one server-owned admin and
Better Auth credential with Better Auth password hashing, and rejects existing
identities without overwriting them. Multiple accounts are supported; public
signup stays disabled. Password reset requires exactly one existing admin and
one password credential. It atomically replaces the password and removes all
that user's sessions; other administrators remain signed in. Use reset for
password recovery and revocation when a credential is compromised. There is no
email recovery flow. Basic Auth remains a separate temporary bypass until the
browser authentication cutover; these commands do not change Basic credentials.

## Isolated verification

```sh
bun run test:auth:integration
```

Requires Docker Compose. This is the `--auth-only` mode of
`scripts/run-integration-tests`, using `compose.integration.yml` and the
existing `archive-backend-integration` project. The default integration run
executes these Bun tests before the Playwright API/browser specs. Both use the
same disposable PostgreSQL and migration service, publish no ports, and use no
normal archive volume. Auth tests use Fastify injection with Basic Auth
disabled; browser specs retain their existing local Basic Auth configuration.
Tests run sequentially so rollback triggers cannot interfere with other
authentication work. The runner stops on the first failure and removes its
containers, network, and volumes on exit. Do not run two copies of this shared
project at once or point the tests at a real archive database.
`playwright.config.ts` selects only `*.spec.ts` files; Bun runs
`integration-tests/auth/` explicitly.

Coverage includes normalized/duplicate provisioning, multiple administrators,
invalid/valid login, cookie-backed protected access, logout, disabled signup,
password reset, revoked-cookie rejection, unaffected other-user sessions, and
rollback after forced credential insertion or session deletion failures. Browser
login and the later CSRF/rate-limit configuration remain separate checkpoints.

Verified on 2026-09-30:

- Admin build and all 182 unit tests passed (620 assertions), without a database
  environment override. Typecheck, lint, and diff checks passed.
- All three isolated auth tests passed (25 assertions). The disposable project
  was removed successfully afterward. Expired sessions and non-admin access
  rejection are covered as well.
- A pseudo-terminal check verified hidden entry, backspace, Ctrl-C/Ctrl-D
  cancellation, and process exit without echoing passwords. It exposed a Bun
  stdin cleanup issue: prompts now restore the prior flowing state so commands
  terminate after input completes.
- No regular archive database was changed. No UI changed, so agent-browser
  verification does not apply to this chunk. Browser login remains
  unimplemented.

## Consolidation verification — 2026-09-30

The default shared runner passed all 3 Bun auth tests (25 assertions), followed
by all 79 Playwright API/browser tests, and removed its disposable stack.
Typecheck, lint, shell syntax, and diff checks passed. A runner check with a
substitute Docker command verified auth-only selection, default ordering,
nonzero failure propagation, and cleanup on success/failure. No runtime or UI
behavior changed in this consolidation; no admin UI acceptance check applies.
