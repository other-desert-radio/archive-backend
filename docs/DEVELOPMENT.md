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

The admin-only publisher uses these settings. The export-only
`bun run publish-locally` command reads `ARCHIVE_CHECKOUT_PATH`; see
[the export guide](ARCHIVE_EXPORT.md) for its standalone fallback and asset
ownership rules.

```dotenv
ARCHIVE_SITE_REPOSITORY=git@github.com:other-desert-radio/archive-site.git
ARCHIVE_CHECKOUT_PATH=../clean-archive-site
ARCHIVE_CONTAINER_CHECKOUT_PATH=/archive-site
ARCHIVE_PUBLISH_BRANCH=publish-dev
ARCHIVE_PUBLISH_ENABLED=true
```

The application reads `ARCHIVE_CHECKOUT_PATH` only. Relative paths resolve from
the explicit backend repository root, independently of the command's working
directory. Compose passes `ARCHIVE_CONTAINER_CHECKOUT_PATH` as the application's
`ARCHIVE_CHECKOUT_PATH`; it is not a second application setting. The checkout
must be separate from the backend, with neither containing the other. This
configuration check is lexical; filesystem, symlink, repository, and actual
branch validation run before publication.

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

The publication validator inspects the checkout locally without fetching,
writing files, changing the index, or contacting a remote. It requires an
existing dedicated normal clone, the repository root on the configured branch
with a committed HEAD, and one origin fetch URL and one effective push URL
matching the configured repository exactly. Linked worktrees, submodule
checkouts, and symlinked `.git` directories are rejected. The current
configuration must match the job's saved target.

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
fetch/fast-forward, and interrupted-work reconciliation run after validation;
passing validation alone does not authorize a push. Tests use temporary local
repositories and never contact GitHub.

### Publication synchronization

`synchronizePublicationCheckout` validates the checkout, rejects staged/unmerged
changes, and fetches the configured branch from origin into its explicit
remote-tracking ref. For the first `publish-dev` publication only, if neither
origin nor its tracking ref has that branch, it instead fetches and verifies
remote `main` as the baseline. The first successful push creates `publish-dev`,
even if generated output already matches `main`. A missing `main`, missing
previously tracked target, or other missing target fails. Fetch does not fetch
tags, recurse into submodules, or run automatic maintenance. It can update local
objects and the tracking ref; it never pushes or changes the local branch by
itself. An unavailable remote fails with a fixed error, without raw Git stderr.

After fetch, any remaining local commits (ahead or diverged history) block
synchronization. Explicit Retry reconciles recognized interrupted publisher
commits before synchronization. If local HEAD already matches the fetched
commit, synchronization finishes without changing files. Otherwise Git performs
only `merge --ff-only --no-autostash` against the captured fetched commit, then
revalidates checkout/output safety. Hooks and filesystem-monitor commands are
disabled. Unrelated unstaged/untracked edits remain when compatible with that
fast-forward; conflicting work causes failure rather than overwrite or stash.
Staged work must be resolved before synchronization.

Git subprocesses use argument arrays and fixed errors/log messages. SSH uses
batch mode and strict host-key checking; verified known-hosts and credentials
are provisioned by the runtime setup below. Fetch has a 30-second timeout; local
commands have a 10-second timeout. Global/system Git configuration and inherited
Git redirection are ignored as in checkout inspection. Temporary bare remotes
cover synchronization tests without GitHub access. Publisher-commit
reconciliation precedes a fresh export and commit/push.

### Server setup command

Install Bun, Git, OpenSSH, and Docker with Compose on the host. Configure an
untracked `.env` with the public HTTPS `BETTER_AUTH_URL`, a unique
`BETTER_AUTH_SECRET` (at least 32 characters), a non-example database password,
`ARCHIVE_PUBLISH_ENABLED=true`, `ARCHIVE_PUBLISH_BRANCH=main`, and explicit
`ARCHIVE_GIT_NAME` / `ARCHIVE_GIT_EMAIL` for publication commits. Set
`ARCHIVE_RUNTIME_UID` and `ARCHIVE_RUNTIME_GID` to the numeric owner of the
checkout and deploy key (`id -u` / `id -g` for that service account). Provision
the write deploy key and verified known-hosts file at the configured paths
outside the backend repository; restrict private-key permissions to `0600` or
stricter.

Run from the backend repository (or invoke the script by absolute path):

```bash
./scripts/setup-server
# After backup and review of all pending migrations:
./scripts/setup-server --migrate
```

The command explains each step and waits for Enter before each external command;
type `q` to stop. Use `--yes` to skip prompts for unattended execution (required
without a terminal), optionally combined with `--migrate`. Stopping or a failure
leaves completed changes in place.

The command validates configuration, dependencies, Docker access, and SSH mount
sources, installs locked Bun dependencies, and reuses
`scripts/setup-archive-publication` to prepare the dedicated checkout and local
Git identity. It builds the API image, starts PostgreSQL, optionally applies all
pending migrations, validates publication schema and checkout using the actual
container mounts and per-command Git trust exception, checks SSH remote read
access, starts the API, and checks its health endpoint. Read access does not
prove that the deploy key has repository write permission; grant that permission
when provisioning the key. Setup does not publish or retry a publication. The
SSH key is checked for unattended use without a passphrase or host agent before
checkout preparation; use a dedicated publication key rather than weakening a
development key. The container readiness check requires publishing to be enabled
and resolves author and committer identity from its environment without creating
a commit. Branch mismatches name both the checkout branch and configured
publication branch. Remote-authentication failures explain how to verify the
configured key and repository deploy-key access.

Without `--migrate`, missing publication tables fail readiness with migration
guidance. Failed readiness or migration checks stop before API startup; an
already-running API is not stopped. Reruns preserve existing `.env`,
credentials, and checkout work. The command does not install host packages,
create SSH keys, trust unverified host keys, configure DNS/TLS, or create an
administrator. Configure HTTPS routing to the API port separately, then use
`scripts/create-admin` for the initial administrator as described above.
Changing PostgreSQL password variables does not rotate credentials in an
existing data volume; use the database's credential-rotation procedure
separately.

### Prepare the dedicated checkout and SSH files

Run setup from the backend after installing Bun and Git and copying
`.env.example` to an untracked `.env`:

```bash
./scripts/setup-archive-publication
```

The script loads the backend `.env` with exported environment values taking
precedence. It clones the configured repository when the destination is absent,
otherwise validates its root and origin. It selects an existing target branch,
or creates the target from its remote tracking branch; when neither exists it
fetches remote `main` and creates the local target there. Local setup defaults
to `publish-dev`. Set `ARCHIVE_PUBLISH_BRANCH=main` on the server. Setup never
pushes, commits, resets, stashes, or deletes work. A dirty checkout on another
branch or an unfinished Git operation requires manual resolution. Dirty work on
the target branch is preserved; setup success does not guarantee it is safe to
publish. `ARCHIVE_GIT_NAME` and `ARCHIVE_GIT_EMAIL` supply the publisher commit
identity inside Docker through Compose. The publisher applies them per commit,
so a fresh checkout needs no manual Git configuration. Setup also writes these
values locally in the checkout; outside Compose, existing local identity may be
retained by leaving both unset. If either is supplied, both must be nonempty. Do
not depend on global Git identity/configuration, which publication ignores.
Publisher Git commands trust only the configured checkout through a per-command
`safe.directory` entry, allowing a host-owned bind mount inside the container
without changing global trust settings.

Create a dedicated SSH deploy key outside the repository and add its public key
to the archive-site repository with write access. Provision the private key and
a `known_hosts` file at the `.env` paths `ARCHIVE_DEPLOY_KEY_PATH` and
`ARCHIVE_KNOWN_HOSTS_PATH`. Verify the Git host's public-key fingerprints
through its official documentation or another trusted channel before trusting
the entries; `ssh-keyscan` output by itself does not verify the host. Use an
unencrypted dedicated service key with restricted host access for unattended
publication, and mode `0600` for the private key. Keep these files and the
checkout outside the backend build context. For host setup, make the same
identity and verified hosts available to the current user's SSH client
(`~/.ssh/id_ed25519` and `~/.ssh/known_hosts`, or its SSH configuration).

Existing SSH files can be mounted directly instead of copied to the default
`../archive-publication-ssh/` directory. For example, set these absolute host
paths in the backend `.env`, replacing the username and key filename as needed:

```dotenv
ARCHIVE_DEPLOY_KEY_PATH=/home/garrepi/.ssh/id_ed25519
ARCHIVE_KNOWN_HOSTS_PATH=/home/garrepi/.ssh/known_hosts
```

The existing private key must have write access to the archive-site repository
and work without a passphrase or SSH agent; the container does not inherit the
host's SSH agent or SSH configuration. The existing `known_hosts` file must
contain a verified entry for the configured Git host (`github.com` by default).
A dedicated service key remains recommended. Both paths must point to existing
files; setting only `ARCHIVE_KNOWN_HOSTS_PATH` leaves the private-key mount at
its default path. An `invalid mount config for type "bind"` error names the
missing host path: provision that file or update its corresponding `.env`
setting. The setup script prepares the checkout, not these SSH files. After
updating the paths, rerun `docker compose up -d --build`.

Compose bind-mounts the checkout persistently and the two credential files
read-only into `/run/archive-ssh/id_ed25519` and `/run/archive-ssh/known_hosts`.
The image’s SSH configuration uses these paths. The API runs as the non-root
`bun` service account, built with `ARCHIVE_RUNTIME_UID` / `ARCHIVE_RUNTIME_GID`
(both default to 1000). Missing bind sources fail instead of silently creating
empty directories; prepare them even when running this Compose file with
publishing disabled. The application sees only the mounted
`ARCHIVE_CONTAINER_CHECKOUT_PATH` under its normal `ARCHIVE_CHECKOUT_PATH`
setting. Host-relative bind paths resolve from the backend Compose project
directory. Credentials are never copied into the image. The checkout and private
key must be owned by the configured runtime UID; the checkout group must match
the runtime GID. Use your own IDs locally and a dedicated service account on
servers. Rebuild the image after changing IDs. Setup checks write access to
generated-output and Git directories, creates a temporary file through the
container, verifies its host-side owner, and removes it. This detects
incompatible rootless/user-namespace mappings before API startup. Existing files
created by an earlier root runtime need a one-time ownership repair; setup
reports the mismatch and does not recursively chown or discard checkout work.
Keep SSH files read-only to the container.

Back up the database and dedicated checkout together; job recovery relies on
retained Git objects and durable job records. Do not share this checkout with
another publisher or an interactive editing workflow.

### Publication operation and recovery

Apply the reviewed database migrations before enabling publication, then build
and start the API with `docker compose up -d --build`. Publication is restricted
to authenticated admins. The header appears for pending archive revisions;
confirming Publish starts a durable server job. Closing or refreshing the page
does not cancel it. Reopen the control to view progress and retained logs.
Editors cannot read publication status, logs, or invoke jobs.

A successful job means the generated files were pushed to GitHub, or already
matched the remote result. It does not mean the site deployment completed. The
archive-site Pages workflow deploys `main` only; pushes to local `publish-dev`
are reviewable publication tests and do not deploy Pages.
`bun run publish-locally` remains an export-only diagnostic command and never
acknowledges pending revisions. A real push to `publish-dev` is a separately
reviewed acceptance operation; automated tests use local temporary remotes.

Only one publisher holds the PostgreSQL advisory lock. Changes arriving after
its captured snapshot remain pending. After a restart, abandoned jobs become
interrupted and require explicit Retry; there is no automatic retry loop.
Recovery recognizes commits tagged with publication job IDs before resuming a
push. Never solve a rejection with force-push, hard reset, or deleting the
checkout: inspect logs and resolve foreign commits, merge conflicts, staged
changes, branch/origin mismatches, SSH permissions, or unavailable remotes
first. Keep the checkout and job history intact so retries can reconcile a
previously successful push. Logs are sanitized and bounded to 2,000 lines per
job; only the latest 10 completed jobs remain.

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
