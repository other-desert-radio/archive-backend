# Local and remote publication

## Decisions

- Work in chunks: structure → scaffolding → implementation for each
  responsibility.
- Replace ARCHIVE_PUBLISH_ENABLED with ARCHIVE_PUBLISH_MODE=local|remote;
  default local.
- Local mode writes exporter-owned assets into ARCHIVE_CHECKOUT_PATH without Git
  operations; unrelated edits are allowed.
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
