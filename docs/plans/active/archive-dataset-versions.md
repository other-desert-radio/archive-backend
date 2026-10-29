# Archive dataset versions

- Decision: backend only; preserve every output path; wrap JSON and add
  res/data_versions.json.
- Decision: database-backed per-dataset hash/version/timestamp; job snapshot;
  shared allocation lock.
- [x] Migration and allocation: implemented and tested; user review pending.
- [x] Export wrappers, manifest, fixtures, and tests: user review pending.
- [x] Publication integration and recovery: user review pending.
- [ ] Focused tests and documentation
- [ ] Verification
- User review remains pending.

## Current checkpoint

- Database chunk: five focused tests pass on disposable PostgreSQL (31
  assertions).
- Covered allocation, unchanged retry metadata, independent changes, job
  snapshots, job deletion, concurrent allocation, rollback, constraints,
  migration down/up.
- No migration applied to the regular database.
- Export/publication edits from the interrupted one-shot are now covered by
  focused checks.
- Export chunk: verified CLI output, manifest agreement, no-op exports,
  independent changes, empty datasets, stale DJ deletion, and image-write
  failure behavior.
- Publication chunk: revision capture and allocation are atomic under the export
  lock; remote recovery copies recorded metadata and leaves newer versions
  alone.
- Verified read-only previews, legacy/wrapped comparisons, manifest staging,
  fingerprints, symlink rejection, and preservation of unrelated files.
- Next after review: final verification and completion review.

## Publication checkpoint verification

- 71 focused export/publication tests passed on disposable PostgreSQL.
- Runner rerun passed all 15 tests after adding two edge cases: legacy jobs
  without version snapshots and snapshot reads after export-lock acquisition.
- Type checking, scoped Biome checks, documentation checks, Markdown lint, and
  diff whitespace checks passed.
- Full-suite final verification and user review remain pending; no regular
  database migration or frontend edits were made.
