# Archive publication

## Current checkpoint

Checkout safety validation was approved by the request for the next chunk. Git
fetch/fast-forward synchronization is implemented and awaits review. It remains
off live runner/startup. Continue with one responsibility per review.

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
- [x] User review of abandoned-job interruption handling.
- [x] Git checkout/repository/branch safety validation.
- [x] User review of checkout safety validation.
- [x] Git fetch and fast-forward synchronization.
- [ ] User review of Git synchronization.
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

Review `synchronizePublicationCheckout` and shared Git subprocess safeguards.
Synchronization validates identity/paths, rejects staged/unmerged changes,
fetches the configured branch, rejects local ahead/diverged history, and permits
only fast-forward without autostashing. Compatible local edits survive; a
conflict preserves files and HEAD. Post-update validation catches unsafe paths
introduced by the fetched commit. No code pushes or acknowledges revisions.

Thirteen Git tests passed with 70 assertions using temporary checkouts and bare
local remotes. Coverage includes compatible local edits, disabled hooks and
autostash, staged rejection before fetch, ahead/diverged histories, conflicting
files, and missing/unavailable remotes. Existing validation tests also pass. No
regular checkout, database, or GitHub remote was modified.

After approval, implement generated-path staging, commit, and non-force push
only. Interrupted-work reconciliation and live runner integration remain
unfinished. Follow [development modes](../../DEVELOPMENT.md#development-modes).
