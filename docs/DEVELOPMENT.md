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

### Initial administrator and browser login

After reviewing and applying the authentication migrations, run
`scripts/create-admin` from an interactive host terminal with the same database
and Better Auth environment as the API. It prompts for email and a hidden,
confirmed password (8–128 characters), and refuses to provision when an admin
already exists. Passwords are hashed by Better Auth; never pass them on a
command line or put them in `.env`. Existing accounts retain admin access after
upgrade.

Open `/admin/` and sign in with email/password. Admins manage accounts and roles
from Users; editors manage all archive resources. Newly assigned/reset passwords
must be replaced on first sign-in. Account owners can change their password
using the current password. Public signup and email-based recovery are absent;
another admin performs resets. Basic Auth credentials no longer grant access.

Set `BETTER_AUTH_URL` to the browser's canonical application URL; HTTPS enables
secure cookies. Better Auth shares the API server and its `PORT`; when using a
Cloudflare Tunnel, route the tunnel to `http://localhost:43827` and keep
`BETTER_AUTH_URL` set to the public HTTPS origin. `BETTER_AUTH_TRUSTED_ORIGINS`
optionally adds comma-separated exact HTTP(S) origins, such as another
development port. Keep production origins explicit. Sessions expire after seven
days; authentication/account changes use database-backed rate limits. Configure
HTTPS before production login.

Set `BETTER_AUTH_SECRET` to a unique random value of at least 32 characters. The
Docker image runs in production mode and rejects the example development secret.
This server secret secures sessions; it is separate from every account's
password. Generate a value with `openssl rand -base64 32` and keep it in the
existing untracked `.env` or deployment secret configuration.

For UI development, run `scripts/build-container-watch` after database setup. It
builds the stack, mounts host `dist/admin` into the API container, and starts
Vite's build watcher. Stop the watcher with Ctrl-C; stop containers separately
with `docker compose down`.

### Archive publication configuration

The publication configuration reader accepts these settings. Runner/startup and
Compose integration are still pending; these settings do not yet enable a
publication job. The export-only `bun run publish-locally` command already reads
`ARCHIVE_CHECKOUT_PATH`; see [the export guide](ARCHIVE_EXPORT.md) for its
standalone fallback and asset ownership rules.

```dotenv
ARCHIVE_SITE_REPOSITORY=git@github.com:other-desert-radio/archive-site.git
ARCHIVE_CHECKOUT_PATH=../clean-archive-site
ARCHIVE_CONTAINER_CHECKOUT_PATH=/archive-site
ARCHIVE_PUBLISH_BRANCH=publish-dev
ARCHIVE_PUBLISH_ENABLED=true
```

The application reads `ARCHIVE_CHECKOUT_PATH` only. Relative paths resolve from
the explicit backend repository root, independently of the command's working
directory. Compose will pass `ARCHIVE_CONTAINER_CHECKOUT_PATH` as the
application's `ARCHIVE_CHECKOUT_PATH`; it is not a second application setting.
The checkout must be separate from the backend, with neither containing the
other. This configuration check is lexical; filesystem, symlink, repository, and
actual branch validation belong to the later checkout safety check.

Unset settings default to the repository, checkout, and branch above, with
publishing **disabled**. The example explicitly enables it. Local publication
targets `publish-dev`; configure `main` on the server. Enablement accepts only
`true` or `false`. Values are trimmed; blank settings and embedded control
characters are rejected, including when publishing is disabled. Repository
settings accept SCP-style SSH, `ssh://`, or `https://` remotes without embedded
passwords, query strings, or fragments; HTTPS usernames are also rejected.
Branch names use letters, numbers, underscores, dots, slashes, or hyphens and
must satisfy the reader's conservative Git name checks. Errors identify the
setting without echoing its value. Reading configuration performs no filesystem,
Git, database, or network operations.

### Publication checkout safety

The publication validator is implemented independently of the unfinished runner.
It inspects the checkout locally without fetching, writing files, changing the
index, or contacting a remote. It requires an existing dedicated normal clone,
the repository root on the configured branch with a committed HEAD, and one
origin fetch URL and one effective push URL matching the configured repository
exactly. Linked worktrees, submodule checkouts, and symlinked `.git` directories
are rejected. The current configuration must match the job's saved target.

Checkout paths are resolved through symlinks before checking separation from the
backend. Existing output ancestors and managed DJ directories must be real
directories; existing managed JSON destinations must be regular files. Symlinks
at those paths are rejected so exports cannot escape the checkout. Missing
output directories/files are allowed because the exporter creates them. Merge,
rebase, cherry-pick, revert, bisect, and sequencer markers block validation
without removing or changing them.

Inspection ignores inherited `GIT_*` environment variables and global/system Git
configuration. Local URL rewrites are reflected in effective origin checks. Git
command failures use a generic error rather than exposing raw stderr or
credential-bearing configuration. Success emits a fixed validation log line.
Staged, unstaged, and untracked edits are preserved and do not by themselves
fail this identity/path check. Dirty-file policy, outgoing-commit recognition,
fetch/fast-forward, and interrupted-work reconciliation belong to later units;
passing validation alone does not authorize a push. Tests use temporary local
repositories and never contact GitHub.

## Local dummy data

`bun run db:seed:djs` and `bun run db:seed:shows` each insert five standalone
records without creating relationships or other resources. They do not clear
existing data; rerunning either command adds another batch.

`bun run db:delete:djs -- --confirm` and `bun run db:delete:shows -- --confirm`
permanently delete every record of that resource and its cascading relationship
rows. Show deletion retains Mixcloud tracking rows and clears their import links
and timestamps.

`bun run db:delete:mixcloud-imports -- --confirm` permanently deletes tracking
rows while preserving the table and all archive resources and relationships.
Clearing tracking removes duplicate-import protection; refresh can repopulate
source rows. All deletion commands use the configured database and require the
explicit confirmation flag.

## Database backups and restores

Use PostgreSQL tools inside the Compose `postgres` service; no host PostgreSQL
installation is needed. These scripts use that service's configured database and
user:

```sh
scripts/pg-dump backups/archive.dump
# On the destination, configure .env and start PostgreSQL:
docker compose up -d postgres
scripts/pg-import backups/archive.dump --confirm
```

Export creates a custom-format dump containing schema and data, including
images, authentication tables, and migration history. It creates missing
directories, refuses to overwrite an existing backup, and uses private file
permissions. The `backups/` directory is ignored by Git.

Import uses `pg_restore`, replaces matching objects and data, requires
`--confirm`, and rolls back the restore on failure. Unrelated destination
objects remain; prefer a fresh database when moving between machines. Stop the
API and other writers during restore, then restart them afterward. Use
PostgreSQL 16 to match Compose. Roles and server settings are not copied;
restored objects belong to the destination's configured user.
