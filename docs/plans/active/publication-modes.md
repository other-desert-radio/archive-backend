# Local and remote publication

## Decisions

- Work in chunks: structure → scaffolding → implementation for each
  responsibility.
- Replace ARCHIVE_PUBLISH_ENABLED with ARCHIVE_PUBLISH_MODE=local|remote;
  default local.
- Local mode writes exporter-owned assets into ARCHIVE_CHECKOUT_PATH; unrelated
  edits are allowed. Read-only Git inspection may capture the actual current
  branch and optional origin URL. Never fetch, synchronize, commit, or push.
- Successful local writes acknowledge the captured revision; concurrent edits
  remain pending.
- Remote publication retains commit/push and recovery behavior. Switching modes
  must allow a fresh remote publication; retries cannot cross targets or modes.
- Preserve output ownership and filesystem separation/symlink safeguards.

## Progress

- [x] Inspect configuration, runner, persistence touchpoints, exporter contract,
      UI, and Compose.
- [x] Propose configuration structure using existing config.ts, types.ts, and
      config.test.ts.
- [x] User reviews structure and requests configuration scaffolding.
- [x] Scaffold configuration contracts.
- [x] User reviews configuration scaffolding.
- [x] Implement configuration reader and focused tests.
- [x] User reviews completed configuration unit.
- [ ] Publication execution and persistence unit, with staged review.
- [ ] Admin UI unit, with staged review and visual acceptance.
- [ ] Development integration: Compose, setup scripts, env examples, local .env,
      authoritative docs.
- [ ] Final verification and user review.

## Current checkpoint

Configuration structure uses src/publication/config.ts for parsing,
src/publication/types.ts for the mode contract, and
tests/publication/config.test.ts for validation. No new source module is
necessary. Tests stay unchanged until the configuration reader has executable
behavior.

Added PublicationMode, a discriminated PublicationModeConfig, and an implemented
readPublicationModeConfig reader. Local configuration contains only mode and
checkoutPath; remote configuration additionally contains repository, branch, and
optional commit identity. The existing reader and runner contract remain active
so startup continues working. The existing publication index exports the
scaffold through its existing barrel exports.

Local mode reuses ARCHIVE_CHECKOUT_PATH and its existing fallback; no additional
path setting is introduced. It ignores remote-only settings. Remote mode reuses
the existing reader's validation with the old enable flag overridden internally;
the mode-aware reader ignores that legacy flag. This temporary reuse will be
removed when the runner adopts mode-aware configuration. Startup still uses the
legacy reader, so this checkpoint does not change live publication behavior.

Configuration verification: 14 tests, typecheck, Biome, and docs checks passed.
The environment helper is named readEnvSetting after user review.

## Next unit: destination validation structure

Split execution and persistence into smaller responsibilities. First extract
filesystem-only validation from git.ts into src/publication/checkout.ts, with
tests/publication/checkout.test.ts. Remote Git validation will call this shared
validator; local execution can later use it without executing Git. Re-export the
validator from src/publication/index.ts. Retain existing remote checks.

Structure and scaffolding approved. Implemented the shared destination validator
and connected remote validation to it. It resolves checkout/backend paths for
separation checks, rejects missing or non-directory destinations, and rejects
symlinked or incorrectly typed output ancestors and top-level generated JSON. It
returns Promise<void> and throws on failure, without Git or filesystem writes.
Remote validation retains its dedicated clone, branch, origin, and Git-state
checks.

Verification: 32 destination/Git tests pass, including 13 filesystem-only tests
using temporary directories without Git. Typecheck and Biome pass. The new local
execution path is not wired yet; live publication remains remote-only.

Next: await review of this completed unit before proposing persisted mode/target
tracking structure, following
[Development modes](../../DEVELOPMENT.md#development-modes). Later units cover
runner integration and UI/development integration, each with staged review.

## Git refactor requested during review

The user requested smaller Git modules and comments explaining the flows before
continuing publication-mode integration. Approved structure: replace git.ts with
git/index.ts, types.ts, commands.ts, validation.ts, remote.ts, commits.ts, and
recovery.ts. Preserve public exports and existing behavior; use direct internal
imports to avoid barrel cycles. Keep filesystem validation in checkout.ts.

First extraction unit: shared Git types and command execution only. Created
git/types.ts and git/commands.ts with responsibility comments after structure
confirmation. Scaffolding now moves shared context/result/recovery types into
git/types.ts and re-exports them from git.ts to preserve existing imports.
Command scaffolding approved and implemented. runGit and inspectGit now live in
git/commands.ts; git.ts imports them directly. Removed the original command
definitions and execution imports. Added comments explaining inherited Git
override filtering, shared execution safeguards, and inspection callers.
Defaults, arguments, identity handling, and sanitized failures are unchanged.

The user then authorized completing all remaining Git extractions in one pass.
Completed validation.ts, remote.ts, commits.ts, recovery.ts, and index.ts;
removed the old git.ts. Updated the publication barrel, runner, and server setup
imports. Adjusted the validator's module-relative backend root for its new
directory. Shared Git path parsing lives in commands.ts; generated-path rules
and commit verification live in commits.ts and are reused by recovery. Public
exports stay limited to the existing runner-facing operations and types.

Added flow comments for validation, normal synchronization, generated-path
staging, durable commit recording before push, and interrupted-job recovery.
Updated the architecture reference with the new module ownership.

Verification: all 51 focused Git/destination/setup tests pass; typecheck and
Biome pass. No Git refactor stubs remain. The original local/remote publication
feature is still incomplete; next propose persisted mode/target tracking
structure and continue the original staged workflow. The one-pass authorization
applied to the remaining Git restructuring requested in this review.

## Current unit: publication-mode persistence

The user approved recording local repository and branch metadata. The checkout
path identifies the local destination; Git inspection should record the actual
checked-out branch and optional origin URL, not the configured remote-publish
branch. Missing origin, detached HEAD, or a non-Git destination must not prevent
local export. Remote fields remain required for remote jobs.

Agreed schema direction: add mode to archive_publication_jobs (existing jobs
remain remote), allow nullable repository/branch metadata for local jobs, and
require a commit ID only for remote success. Add nullable published_target JSONB
to archive_publication_state to associate published_revision with its
destination and detect mode/destination switches. Local target comparison should
include the actual branch when present. Optional origin metadata describes the
local checkout; it does not turn local export into remote publication.

Structure and scaffolding requested. Added explicit up/down migration stubs and
PublicationTarget in src/publication/types.ts, the shared dependency for
persisted target JSON and later job contracts. Local target has optional
repository/branch; remote requires both. The test file remains a responsibility
comment until there is executable behavior. Existing database row types stay
aligned with the current schema until implementation; nullable-column mapping
changes belong to that step.

No database changes have been made. Migration up/down explicitly throw and are
not ready to apply. Down will reject rollback while local jobs exist rather than
silently discard or relabel their history. Later implementation will update
src/db/types.ts, affected row mapping, and docs/DATABASES.md together.

Await scaffolding review before migration implementation, following
[Development modes](../../DEVELOPMENT.md#development-modes).
