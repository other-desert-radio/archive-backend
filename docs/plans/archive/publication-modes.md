# Local and remote publication

## Agreed behavior

- The user switched the remaining feature to one-shot implementation.
- ARCHIVE_PUBLISH_MODE accepts local or remote; default local. The former
  enabled flag is removed.
- ARCHIVE_CHECKOUT_PATH is required; never guess a repository path. The local
  .env and .env.example select ../archive-site. Compose mounts it at the
  configured container checkout path.
- Local mode validates paths, captures a consistent database snapshot, writes
  generated assets, and acknowledges only that revision. Read-only Git
  inspection records the actual branch and optional origin. Never fetch,
  synchronize, switch branches, stage, commit, or push in local mode.
- Remote mode retains safe fetch/fast-forward, commit/push, and explicit retry
  recovery. Mode/destination switches stay pending; retries cannot cross
  targets.
- Retain exporter-owned path replacement/deletion and unrelated local edits.
- The runner uses an explicit mode switch with named steps and flow comments.

## Implementation and verification

- [x] Configuration, explicit destination validation, and mode-aware types.
- [x] Git module split with flow comments, preserving remote behavior.
- [x] Migration 0033: job mode, optional local Git metadata, mode-aware success,
      and acknowledged target JSONB; safe remote backfill and guarded rollback.
- [x] Mode-aware job admission, retries, status, and transactional
      acknowledgement.
- [x] Separate local/remote execution with no remote Git calls in local mode.
- [x] UI destination details, local confirmation/success labels,
      progress/errors.
- [x] Env, Compose remote SSH overlay, build/setup helpers, and authoritative
      docs.
- [x] 109 focused backend/export/migration tests pass with disposable
      PostgreSQL.
- [x] 15 publication browser tests pass in local/remote modes at
      desktop/390/320px.
- [x] Agent-browser screenshots inspected at desktop/390/320px with mocked admin
      data; the normal stack requires sign-in, so no archive data was published.
- [x] Typecheck, admin build, lint, and documentation checks pass.
- [x] Backed up the local database to /tmp/archive-before-publication-modes.sql,
      applied only migration 0033, rebuilt/recreated the local API, and checked
      health plus read-only destination metadata inside the running container.
- [ ] User review of the completed feature.

## Final checks

An additional Git metadata test covers detached HEAD, absent origin, and
credential redaction. Complete its focused verification and final diff check,
then hand off. The running container resolves /archive-site to the host
../archive-site checkout on main. No export to the user's checkout has been
triggered during verification.
