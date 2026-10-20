# Documentation index

Start with automatically applicable [root instructions](../AGENTS.md), identify
the affected code, then read only a matching reference or section. This index is
optional when the relevant path is already known. Ordinary Markdown links do not
import files into agent context. Reuse already-read, unchanged guidance.

- Implementing/refactoring TypeScript → [TYPESCRIPT.md](TYPESCRIPT.md): types,
  barrels, normalization, absence, URL checks
- Changing API routes → [api-routes.md](api-routes.md): authentication, layout,
  request/reply contracts, validation; read only affected resource contracts
- Adding backend lifecycle events →
  [API logging](api-routes.md#logging-new-features): labels, useful context,
  secret exclusions
- Building/editing admin UI → [ADMIN_UI_DESIGN.md](ADMIN_UI_DESIGN.md): shared
  ownership, aesthetic, sizing, interactions, required visual acceptance; read
  resource sections only as needed
- Writing/modifying tests or choosing checks → [TESTING.md](TESTING.md): focused
  checks, suite selection, formatting/hooks
- Testing against real PostgreSQL or browser fixtures →
  [DATABASE_E2E_TESTING.md](DATABASE_E2E_TESTING.md): disposable stack/manual
  setup; coverage catalog only for affected suites
- Changing schema/relationships/migrations → [DATABASES.md](DATABASES.md):
  invariants, typed wiring, explicit reviewed migrations
- Changing service/auth boundaries or preparing deployment →
  [ARCHITECTURE.md](ARCHITECTURE.md): ownership, product decisions, deployment
  limits
- Choosing development mode or working in chunks →
  [Development modes](DEVELOPMENT.md#development-modes): per-task mode
  selection, structure approval, scaffolding, and individual implementation
  units
- Starting local development or using data/backup tools →
  [DEVELOPMENT.md](DEVELOPMENT.md): setup, seeds/deletes, backup/restore
- Configuring server publication →
  [DEVELOPMENT.md](DEVELOPMENT.md#prepare-the-dedicated-checkout-and-ssh-files):
  persistent checkout, Git identity, deploy keys, and recovery
- Changing Mixcloud refresh/tracking/import transactions →
  [MIXCLOUD_IMPORT.md](MIXCLOUD_IMPORT.md): persistence, constraints, deletion
  and import semantics
- Changing title matching, DJ normalization, dates, parser diagnostics →
  [MIXCLOUD_PARSER.md](MIXCLOUD_PARSER.md): ordered matching and suggestions
- Changing exported JSON/images or frontend asset contracts →
  [ARCHIVE_EXPORT.md](ARCHIVE_EXPORT.md): stable public filenames/fields and
  ordering
- Reviewing/regenerating Better Auth schema →
  [BETTER_AUTH_SCHEMA.sql](BETTER_AUTH_SCHEMA.sql): review artifact; migrations
  remain authoritative
- Resuming a persistent multi-step task → Its `plans/active/<task>.md`, if
  present; lifecycle convention in root instructions
- Investigating original product/design intent → [human_docs](../human_docs/):
  historical inputs, not current contracts

## Historical inputs

Only consult these to recover intent, not as implementation instructions:
[product goals](../human_docs/features.md),
[database/export sketches](../human_docs/databases_human.md),
[DJ design sketches](../human_docs/dj_table.md), and
[Mixcloud sketches](../human_docs/fetch-mixcloud.md). Current standards above
take precedence. Completed plans with useful history may live in
`plans/archive/`; this index does not enumerate historical tasks.
