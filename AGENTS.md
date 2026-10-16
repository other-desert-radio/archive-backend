# Agent instructions

## Working scope

Keep changes focused; preserve unrelated local edits. Update authoritative docs
when documented behavior or conventions change.

For substantial new features, architectural changes, or multi-file
implementations without an explicit mode, ask: “Would you like to build this in
chunks (structure → scaffolding → implementation) or one-shot?” Explicit mode
choices apply only to the current task; small fixes/refactors proceed normally.
For mode selection or chunked work, use
[Development modes](docs/DEVELOPMENT.md#development-modes).

## Selective reference loading

Identify the affected code first. Follow the matching reference below only when
its trigger applies; read relevant sections and expand only as needed. Links are
navigation, not automatic imports. Do not load all of `docs/`, follow every
link, or reread unchanged guidance during the same task.

- TypeScript implementation/refactoring → [TypeScript](docs/TYPESCRIPT.md)
- Backend feature lifecycle logging or API routes →
  [API conventions](docs/api-routes.md)
- Admin UI components, layout, style, interactions →
  [UI guide](docs/ADMIN_UI_DESIGN.md)
- Adding/changing tests or selecting verification → [Testing](docs/TESTING.md)
- Schema, relationships, migrations, database types →
  [Database](docs/DATABASES.md)
- Service boundaries, auth ownership, deployment →
  [Architecture](docs/ARCHITECTURE.md)
- Setup, local stack, data utilities, backups →
  [Development](docs/DEVELOPMENT.md)

For other domains or uncertainty, consult
[the documentation index](docs/README.md). A small unrelated edit needs no
reference that does not apply. Admin UI visual acceptance remains mandatory; its
commands and criteria live in the UI guide.

## Task state

For multi-step work needing persistent state, use `docs/plans/active/<task>.md`.
Read only the plan for the current task; track incomplete/completed steps,
blockers, decisions, and next actions there. Never mark user review complete
without user input. Trivial tasks need no plan. On completion, delete disposable
plans or move useful history to `docs/plans/archive/`; update links when moving.
Create these directories only when a plan is needed. Root instructions are not a
task log. Historical notes do not override current reference standards.

## Documentation maintenance

- Search for an existing authoritative reference before creating a document;
  update it instead of duplicating it. Do not create a summary after every task.
- Keep stable conventions separate from temporary implementation details. Remove
  obsolete rules rather than appending exceptions or rules for one-off errors.
- Update links/indexes when moving or deleting documents. Do not add
  unconditional reads without a concrete reason; keep agent-specific
  configuration minimal.
- Prefer existing linters, formatting, type checks, and tests to prose
  enforcement. Run `bun run docs:check` for documentation changes.
