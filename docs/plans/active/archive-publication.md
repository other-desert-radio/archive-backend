# Archive publication

## Current checkpoint

Stage 2: user requested the next chunk. Typed backend, route, stream-client, and
UI contracts now exist with explicit unfinished stubs. They are disconnected
from live routes and startup. Awaiting scaffolding review before unit 1.
Existing application behavior and the export launcher remain unchanged. The
launcher rename is deferred to implementation unit 2.

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
- [ ] User review of scaffolding.
- [ ] Unit 1: revision migration and triggers.
- [ ] Unit 2: checkout configuration, launcher rename, snapshot export.
- [ ] Unit 3: durable jobs, bounded logs, locking, interruption handling.
- [ ] Unit 4: Git synchronization, publication, recovery.
- [ ] Unit 5: status and publication APIs.
- [ ] Unit 6: notifications and authenticated SSE.
- [ ] Unit 7: header control.
- [ ] Unit 8: confirmation/progress/reconnect/retry modal.
- [ ] Unit 9: setup, Docker/SSH, operational documentation.
- [ ] Unit 10: integrated acceptance.

Each implementation unit requires approval before starting the next. Use
disposable databases and temporary Git remotes for tests. Browser acceptance
must cover desktop, 390px, and 320px. Real GitHub push requires separate review.

## Next action

Approve scaffolding before implementing unit 1 (revision migration/triggers).
Migration files deliberately remain comment-only: the runner discovers exported
migrations automatically. Shell, CSS, and test placeholders remain unfinished;
no tests assert stub behavior. Follow
[development modes](../../DEVELOPMENT.md#development-modes).
