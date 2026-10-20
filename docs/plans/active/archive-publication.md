# Archive publication

## Current checkpoint

Revision state migration and transactional triggers are implemented and verified
against a dedicated disposable PostgreSQL container. Awaiting user review before
checkout configuration. Other stubs remain provisional and disconnected from
live routes/startup. Continue with one responsibility per review using the
revised development workflow. The export launcher remains unchanged.

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
- [ ] User review of revision state and triggers.
- [ ] Checkout configuration and path validation.
- [ ] Export-only launcher rename and configured destinations.
- [ ] Consistent-snapshot archive reading.
- [ ] Durable job schema and persistence.
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

Review migration `0029`, its database types, focused migration test, and
database documentation. It starts pending at revision 1/published revision 0 and
sends commit-delivered `archive_publication_changed` notifications. Write
statements, including zero-row operations and cascading relationship deletes,
advance the revision. Rollback cancels both state changes and notifications.
Migration rollback/reapply preserves archive records. No regular database was
migrated.

Focused verification uses `PUBLICATION_MIGRATION_TEST_DATABASE_URL` and a unique
schema in a disposable PostgreSQL database; it skips when that variable is
unset. The completed run passed 34 assertions including concurrent writers and
bigint precision. Remaining migrations, shell, CSS, and tests retain
placeholders. After approval, the next checkpoint is checkout configuration and
path validation only. Follow
[development modes](../../DEVELOPMENT.md#development-modes).
