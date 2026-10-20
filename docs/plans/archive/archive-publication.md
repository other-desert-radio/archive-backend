# Archive publication implementation

The user switched this task from staged reviews to one-shot completion and
explicitly requested sub-agents. Implementation is complete; user acceptance and
a real GitHub push have not been performed.

## Delivered

- Transactional archive revision tracking and consistent-snapshot export.
- Durable jobs, bounded sanitized logs, advisory locking, and restart
  interruption.
- Generated-path commits, non-force push, recognized-commit recovery, and atomic
  captured-revision acknowledgement. Retry reconciles an earlier snapshot first;
  newer database edits remain pending for another publication.
- Admin-only status/start/detail APIs, PostgreSQL notifications, authenticated
  SSE, and durable reconnect behavior.
- Responsive header control, confirmation/progress/log modal, explicit retry,
  focus handling, and editor isolation.
- Export-only `publish-locally`, safe checkout setup, Docker Git/SSH and runtime
  checkout/key/known-host mounts, and authoritative operational documentation.

## Verification

- Full Bun suite: 444 passed, 11 unrelated database tests skipped, zero
  failures.
- Disposable publication database tests cover migrations/rollback, concurrent
  starts, snapshot consistency, push rejection/retry, lost commit recording,
  already-pushed recovery, notifications, SSE reconnect, and authorization.
- Six publication browser tests and 19 existing modal/layout tests passed using
  isolated mocked APIs. Agent-browser screenshots inspected at desktop, 390px,
  and 320px; real archive data was not changed.
- Production admin build, TypeScript, lint, documentation checks, Docker image
  build, and Compose configuration passed. Lint retains the existing oversized
  Mixcloud JSON warning.
- Real disposable server smoke passed: all migrations, startup, administrator
  login, anonymous rejection, durable publication status, and authenticated SSE.

All Git pushes in tests targeted local bare remotes. The regular database and
real archive checkout were untouched. Deployment still requires the documented
checkout, Git identity, write deploy key, verified known-hosts, and migrations.
A real push to publish-dev remains a separately reviewed acceptance step.

The reusable module/tests retain export-archive names at the user's request. The
user explicitly authorized the brief human database-note addition.
