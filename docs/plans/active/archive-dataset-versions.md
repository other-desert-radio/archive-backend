# Archive dataset versions

- Decision: backend only; preserve every output path; wrap JSON and add
  res/data_versions.json.
- Decision: database-backed per-dataset hash/version/timestamp; job snapshot;
  shared allocation lock.
- [x] Migration and allocation: implemented and tested; user review pending.
- [x] Export wrappers, manifest, fixtures, and tests: user review pending.
- [ ] Publication integration and recovery
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
- Export/publication edits from the interrupted one-shot remain unverified.
- Export chunk: verified CLI output, manifest agreement, no-op exports,
  independent changes, empty datasets, stale DJ deletion, and image-write
  failure behavior.
- Next after review: publication integration and recovery.
- Publication chunk must capture snapshots under the shared lock and verify
  recorded-version recovery; current integration is incomplete.
