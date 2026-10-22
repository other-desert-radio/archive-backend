# Development and operations

Read only the section needed for development mode, local setup, data utilities,
or backups.

## Development modes

Choose a mode for the current task, not as a permanent user preference. For
substantial new features, architectural changes, or multi-file implementations
without an explicit mode, ask before implementation:

> Would you like to build this in chunks (structure → scaffolding →
> implementation) or one-shot?

Wait for the answer before dependent work; relevant read-only inspection may
continue. Small fixes, straightforward refactors, and minor edits proceed
normally unless chunked mode is requested. Do not ask again when the user
already chose.

- **Chunked:** Explicit requests for chunked/incremental development,
  scaffolding, step-by-step work, or pair programming select the staged workflow
  below.
- **One-shot:** Requests for a complete implementation or explicit one-shot work
  authorize autonomous implementation, appropriate tests, integrated
  verification, and a final report without routine stage approvals. Keep scope
  focused and follow the same engineering conventions and operation-specific
  safeguards.

Never advance a chunked stage or implementation unit without user approval.
Structure approval alone does not request scaffolding; wait until the user asks
for it. Scaffolding approval authorizes the first agreed implementation unit,
not all remaining functions. User directions can change types, scope, or order
without restarting planning. “Skip ahead and finish the rest” switches the
remaining work to one-shot; any explicit switch applies immediately to this
task.

Chunked work means one small, reviewable responsibility at a time, including
structure and scaffolding. Do not scaffold an entire feature across database,
backend, API, and UI in one checkpoint. A shared feature name or a passing type
check does not make those changes one reviewable unit. Split a chunk when its
contracts or behavior require separate explanations to assess.

For substantial features, agree a brief sequence of responsibilities first, then
apply structure → scaffolding → implementation to each responsibility in turn.
Show the detailed file tree and introduce contracts only for the current unit
and its necessary dependencies. Complete and review that unit before starting
the next; do not create speculative stubs for later layers. Closely coupled
changes may share a checkpoint when they can be understood and verified
together. A request such as “next chunk” advances one agreed checkpoint, not all
remaining scaffolding or a whole application layer.

### Stage 1 — File structure

Inspect relevant code and architecture first; identify reusable
modules/functions for the current unit. Propose the smallest file set and show a
concise tree marked `[new]` and `[modified]`. Explain each file's
responsibility, dependencies, and data-flow direction, including which existing
modules will be reused.

Create only the agreed new files, empty or with a short responsibility comment;
if the proposed file set is not agreed, get agreement before creating it.
Existing files remain functional and unchanged unless a specific structural
change is explicitly necessary and approved. Do not create types, interfaces,
classes, function bodies, imports/exports, or substantial scaffolding yet. If
the user revises the structure, make only those changes.

Stop for file-tree inspection. Wait for explicit structure approval and a
request such as “make the scaffolding” before Stage 2; one message can supply
both.

### Stage 2 — Types and scaffolding

Follow [TypeScript conventions](TYPESCRIPT.md), including `type` aliases rather
than new interfaces. Scope scaffolding to the current unit; defer backend, API,
and UI contracts belonging to later units. Establish public contracts,
meaningful typed parameters and returns, named imports/exports, and module or
class declarations only where justified. Use concise comments to explain
responsibilities and connections.

Show minimal entry points/call sites connecting stubs. An orchestration skeleton
may call those stubs to illustrate flow, but must contain no business logic.
Mark unfinished functions explicitly, for example
`throw new Error("Not implemented: saveShow")`. Do not return fabricated data,
fake success, or silent no-ops. Prefer functions over classes and avoid
speculative abstractions. Keep scaffolding off live routes/startup where
possible; identify any temporarily nonfunctional paths. Do not disguise
incomplete work with unsafe casts, non-null assertions, or blanket lint/type
suppressions.

Present the resulting file tree, important types/contracts, a compact call-flow
outline, and the list of unimplemented functions. Identify key inputs/outputs,
side effects, and error paths. For example:

```text
HTTP request → route handler → validate input → persist record → HTTP response
                              invalid → 400    failure → rollback / generic 500
```

This is an illustration, not a required architecture. Keep explanations local;
do not generate a separate architecture document for a trivial feature. Run
practical structural/type checks and disclose expected stub limitations; passing
checks does not mean the feature works. Stop for scaffolding approval before
replacing stubs with behavior.

### Stage 3 — Implement one unit

For each approved unit:

1. Briefly explain its role, callers, and inputs/outputs before editing.
2. Implement one meaningful function or tightly coupled unit, without unrelated
   changes. Prefer small, testable dependencies before
   orchestration/integration. Several obvious functions are not automatically
   one unit.
3. Add/update meaningful focused tests and run practical relevant checks using
   [testing guidance](TESTING.md). Show the changes, data flow, side effects,
   error behavior, and any remaining limitations.
4. Stop for review before the next unit. Follow instructions such as “implement
   validation,” “do the database layer next,” “change the types,” or “show me
   how this gets called” without restarting the earlier stages.

After the last unit, verify integrated functionality and applicable acceptance
checks. Keep reports short; use the existing task-state convention only when
persistent state is useful, not a new Markdown report after every unit.

## Local environment and startup

Run commands from the repository root. Copy `.env.example` to `.env` only if a
local file does not already exist, then configure its values. Keep `.env`
untracked; update `.env.example` when introducing required variables.

Compose runs the API and PostgreSQL 16. Ports come from `PORT` and
`POSTGRES_PORT` (normally 43827 and 5432). Database data persists in
`archive_postgres_data`; container rebuilds do not apply migrations.

The API container uses the `postgres` service hostname. Host commands use
`DATABASE_URL` when supplied; otherwise `src/db/db.ts` constructs a URL from
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, optional `POSTGRES_HOST`
(default `localhost`), and optional `POSTGRES_PORT` (default `5432`).

```sh
bun install
scripts/build-container
# After reviewing the pending migration, apply one step:
scripts/migrate up
curl http://localhost:43827/health
```

Repeat migration steps after each review checkpoint. Use
`scripts/run-migrations` only when all pending migrations have been reviewed.
Startup checks PostgreSQL connectivity; `/health` is public.

### Mixcloud OAuth configuration

The optional integration uses `MIXCLOUD_CLIENT_ID`, `MIXCLOUD_CLIENT_SECRET`,
`MIXCLOUD_REDIRECT_URI`, and `MIXCLOUD_TOKEN_ENCRYPTION_KEY`. Configure all four
together, or leave all four blank to disable it. The configuration reader
rejects partial settings without printing their values. Startup validates these
settings and constructs the provider client and store once. Partial settings
prevent startup; complete all four or clear all four. Connect, status, callback,
and disconnect routes are registered under the admin API boundary. The upload
page at `/admin/#upload` provides connection status, sign-in, and sign-out.
Review and explicitly apply migration `0034_add_mixcloud_connections` before
using configured routes.
