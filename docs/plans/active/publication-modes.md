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
- [ ] User reviews completed configuration unit.
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

Next: review this unit, then propose the structure for execution and
persistence, following
[Development modes](../../DEVELOPMENT.md#development-modes). Do not advance to
execution or persistence implementation without its staged review.
