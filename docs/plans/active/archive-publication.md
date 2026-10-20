# Archive publication

## Current checkpoint

User approved the existing scaffolding, but found the combined backend/API/UI
checkpoint too large. Continue with one small responsibility per review, using
the revised development workflow. Existing stubs are provisional; review and
refine only those needed for the current unit rather than expanding them all.
They remain disconnected from live routes and startup. Existing application
behavior and the export launcher remain unchanged. The launcher rename is
deferred to implementation unit 2.

## Agreed scope

Admin-only durable archive publication with revision tracking, consistent
snapshot export, conservative Git synchronization/recovery, authenticated live
progress, and a reconnectable confirmation modal. Local publication targets
`publish-dev`; server publication targets `main`. Success means pushed to
GitHub. Standalone `publish-locally` exports without committing or acknowledging
revisions. Preserve unrelated Git work and assets; leave
`human_docs/databases_human.md` unchanged.

## Review gates

- [x] Agree file structure, then create only approved placeholders.
- [x] Explicitly request scaffolding; establish contracts and unfinished stubs
      off live routes/startup and verify structure.
- [x] User review of existing scaffolding.
- [ ] Revision state migration and transactional triggers, with rollback tests.
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

Next implementation checkpoint: revision state migration and transactional
triggers only, with disposable-database verification. This documentation update
does not start that implementation. Migration files deliberately remain
comment-only: the runner discovers exported migrations automatically. Shell,
CSS, and test placeholders remain unfinished; no tests assert stub behavior.
Follow [development modes](../../DEVELOPMENT.md#development-modes).
