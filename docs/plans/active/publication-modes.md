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
- [ ] User reviews configuration scaffolding.
- [ ] Implement and verify configuration unit; review.
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

Added PublicationMode, a discriminated PublicationModeConfig, and an explicit
readPublicationModeConfig stub. Local configuration contains only mode and
checkoutPath; remote configuration additionally contains repository, branch, and
optional commit identity. The existing reader and runner contract remain active
so startup continues working. The existing publication index exports the
scaffold through its existing barrel exports.

Next: wait for scaffolding approval before implementing the reader, following
[Development modes](../../DEVELOPMENT.md#development-modes). Read TypeScript and
testing guidance for this checkpoint; do not scaffold later layers. The new
reader throws until implementation and is not called by startup.
