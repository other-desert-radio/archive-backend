# Archive dataset versions

- Decision: backend only; preserve every output path; wrap JSON and add
  res/data_versions.json.
- Decision: database-backed per-dataset hash/version/timestamp; job snapshot;
  shared allocation lock.
- [ ] Migration and allocation
- [ ] Export and publication integration
- [ ] Focused tests and documentation
- [ ] Verification
- User review remains pending.
