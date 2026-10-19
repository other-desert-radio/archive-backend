# Testing and verification

Read when adding/changing tests or choosing checks for changed behavior. Use the
smallest relevant checks; report failures and unavailable checks.

## Choosing checks

- TypeScript: `bun run typecheck`, focused `bun test tests/path-to-test.ts`, and
  `bun run admin:build` when the admin bundle is affected.
- Full Bun suite: `bun run test` builds the admin bundle and tests `tests/`.
  Playwright suites in `integration-tests/` run separately.
- Real database/API/browser workflows: `bun run test:integration` builds a
  disposable Compose stack and removes only its own containers and test volume.
  The auth suite runs serially first against that disposable database, including
  migration rollback/reapply, cookie roles, and rate-limit checks; remaining
  browser suites share a real authenticated cookie fixture. Their page fixture
  reuses one saved safe user summary for `/api/auth/get-session` so resource
  tests do not exhaust the production session-read rate limit; archive API
  requests still authenticate their real cookies. The separate `@auth` suites
  use unmodified Playwright and exercise real session reads and rate limits. The
  API is available at `http://127.0.0.1:3001` while the stack runs
  (`INTEGRATION_API_PORT` overrides the port). See
  [the database runbook](DATABASE_E2E_TESTING.md) for manual setup and
  feature-specific coverage; do not read its coverage catalog for unit tests.
- Migration tests require an explicit disposable database URL and otherwise
  skip. Check the test's environment variable, including
  `MIXCLOUD_MIGRATION_TEST_DATABASE_URL` or `SHOW_MIGRATION_TEST_DATABASE_URL`.
  Never seed or mutate the regular archive database for verification.
- Admin layout, styling, or interactions require the browser acceptance checks
  in [the UI guide](ADMIN_UI_DESIGN.md#verification-and-delivery).
- Documentation: `bun run docs:check` and Markdown lint; application builds or
  database tests are unnecessary for documentation-only edits.

Add focused tests for new behavior. Route tests cover success, invalid input,
authentication/authorization, and database failures where applicable; preserve
admin-boundary coverage. Prefer pure helper tests for normalization and sorting,
and browser checks for interactions. Use existing fixtures and test conventions.
Assert observable behavior at the appropriate boundary rather than private
function structure or incidental call order. Do not add tests that only repeat
the implementation or assert that scaffolding throws “Not implemented.” In
chunked mode, verify completed units as they become executable; after
integration, verify the complete flow and required acceptance checks. One-shot
work has the same verification requirements without intermediate review gates.

## Formatting and lint

Run formatting, lint, TypeScript checks, and the smallest relevant tests for
code changes. Scope formatting to changed files to preserve unrelated work.
`bun run format` formats the repository; `bun run lint` checks Biome and
Markdown. The authoritative rule configuration is `biome.json` and
`.markdownlint-cli2.yaml`; do not repeat individual lint exceptions in prose.

`bun run setup-hooks` installs the tracked pre-commit hook. It formats staged
files, stages those formatting edits, then runs repository-wide lint. Unstaged
files are not formatted or added. Partially staged files stop the commit before
formatting: stage remaining changes or stash unstaged changes before retrying.
