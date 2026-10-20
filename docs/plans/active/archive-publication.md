# Archive publication

## Current checkpoint

Advisory locking/admission was approved by the request for the next chunk.
Abandoned-job interruption is implemented and awaits review. It requires a fresh
active lease and remains off live startup. Continue with one responsibility per
review.

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
- [x] User review of durable job schema and persistence.
- [x] Approve logs/retention structure and create migration placeholder.
- [x] Logs/retention scaffolding.
- [x] User review of logs/retention scaffolding.
- [x] Sanitized bounded logs and completed-job retention.
- [x] User review of logs and retention implementation.
- [x] Advisory-lock ownership and concurrent-start rejection.
- [x] User review of advisory locking and admission.
- [x] Abandoned-job interruption handling.
- [ ] User review of abandoned-job interruption handling.
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

Review `interruptAbandonedPublications` and active-lease tracking. Recovery must
run under a freshly acquired startup lease before reserving jobs. It marks
running jobs interrupted with a fixed explicit-retry message, preserves recovery
metadata/logs, and prunes completed history in the same transaction. Fabricated
and released leases are rejected. It never starts jobs, touches Git, or
acknowledges publication revisions; startup invocation is still deferred.

Five focused storage tests passed with 138 assertions against disposable
PostgreSQL, including lease guards, preserving pushing/queued jobs and terminal
history, transaction rollback on retention failure, unchanged archive revision
state, idempotent recovery, and an explicit subsequent retry reservation. No
regular database was changed.

After approval, implement Git checkout/repository/branch safety validation only.
Retry eligibility, completion/acknowledgement, runner orchestration, and live
API integration remain unfinished. Follow
[development modes](../../DEVELOPMENT.md#development-modes).
