# Archive publication

## Current checkpoint

Durable job schema and metadata persistence are implemented and awaiting review.
The reusable exporter and tests retain their `export-archive` filenames. Other
stubs remain provisional and disconnected from live routes/startup. Continue
with one responsibility per review.

## Agreed scope

Admin-only durable archive publication with revision tracking, consistent
snapshot export, conservative Git synchronization/recovery, authenticated live
progress, and a reconnectable confirmation modal. Local publication targets
`publish-dev`; server publication targets `main`. Success means pushed to
GitHub. Standalone `publish-locally` exports without committing or acknowledging
revisions. Preserve unrelated Git work and assets. The user subsequently
requested a brief publication-state entry in `human_docs/databases_human.md`;
that specific update is included alongside the authoritative database reference.

## Review gates

- [x] Agree file structure, then create only approved placeholders.
- [x] Explicitly request scaffolding; establish contracts and unfinished stubs
      off live routes/startup and verify structure.
- [x] User review of existing scaffolding.
- [x] Revision state migration and transactional triggers, with rollback tests.
- [x] User review of revision state and triggers.
- [x] Checkout configuration and path validation.
- [x] User review of checkout configuration and path validation.
- [x] Export-only launcher rename and configured destinations.
- [x] User review of export-only launcher and destinations.
- [x] Consistent-snapshot archive reading.
- [x] User review of consistent-snapshot reading.
- [x] Durable job schema and persistence.
- [ ] User review of durable job schema and persistence.
- [ ] Sanitized bounded logs and completed-job retention.
- [ ] Advisory-lock ownership and concurrent-start rejection.
- [ ] Abandoned-job interruption handling.
- [ ] Git checkout/repository/branch safety validation.
- [ ] Git fetch and fast-forward synchronization.
- [ ] Generated-path staging, commit, and non-force push.
- [ ] Interrupted commit/push reconciliation.
- [ ] Runner orchestration and captured-revision acknowledgement.
- [ ] Admin-only status and job-detail reads.
- [ ] Admin-only publication/retry start endpoint.
- [ ] PostgreSQL notification listener and reconnect behavior.
- [ ] Authenticated SSE and durable-state resynchronization.
- [ ] Browser publication client and reconnectable state.
- [ ] Responsive admin-only header control.
- [ ] Confirmation modal and explicit publication submission.
- [ ] Accessible progress/log view and modal reopen behavior.
- [ ] Failure/retry and refresh reconnection behavior.
- [ ] Safe checkout/identity/branch setup script.
- [ ] Docker Git/SSH installation and runtime checkout/credential mounts.
- [ ] Operational documentation review.
- [ ] Integrated acceptance, including desktop, 390px, and 320px.

Each implementation unit requires approval before starting the next. Use the
structure/scaffolding checkpoints within that unit when new files or contracts
are needed; do not repeat a feature-wide scaffolding pass. Include focused tests
and authoritative documentation updates with the behavior they describe. Split
any listed unit further if it becomes difficult to review. Use disposable
databases and temporary Git remotes for tests. Browser acceptance must cover
desktop, 390px, and 320px. Real GitHub push requires separate review.

## Next action

Review migration `0030`, job database/wire types, and metadata storage
functions. Jobs retain their target and retry identity, support stage updates
and immutable revision/commit capture, and deserialize nullable values into
optional fields. `readPublicationJobRecord` reads metadata without claiming logs
are implemented. `createPublicationJob` now takes named lease/request/config
parameters; it is a storage operation, with admission and retry eligibility
still deferred.

The disposable database test passed 46 assertions covering independent-reader
persistence, constraints, terminal-outcome mapping, rejected progress updates,
transaction rollback, and migration rollback/reapply. No regular database was
modified. Completion/acknowledgement, admission locking, logs/retention, and
startup recovery remain explicit unfinished stubs. Terminal outcomes are tested
through direct database writes until completion orchestration is implemented.

After approval, implement sanitized bounded logs and completed-job retention
only. Follow [development modes](../../DEVELOPMENT.md#development-modes).
