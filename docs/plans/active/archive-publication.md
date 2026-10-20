# Archive publication

## Current checkpoint

Revision state/triggers were reviewed; the user requested the next chunk.
Checkout configuration and lexical path validation are now implemented, with
focused tests and documented environment settings. Awaiting user review before
the export-only launcher rename. Other stubs remain provisional and disconnected
from live routes/startup. Continue with one responsibility per review using the
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
- [x] User review of revision state and triggers.
- [x] Checkout configuration and path validation.
- [ ] User review of checkout configuration and path validation.
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

Review `src/publication/config.ts`, its focused tests, `.env.example`, and the
publication configuration section in the development guide. The reader defaults
to disabled, validates settings, and resolves host paths from an explicit
absolute backend root. Compose mapping, real filesystem/symlink/Git checks, and
startup integration remain deferred. Eight configuration tests passed with 58
assertions. Previous disposable migration verification passed 34 assertions; no
regular database was migrated.

After approval, the next checkpoint is the export-only launcher rename and
configured destinations. Keep consistent-snapshot reading for its own review.
Follow [development modes](../../DEVELOPMENT.md#development-modes).
