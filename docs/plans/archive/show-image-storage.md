# Show image storage

- Mode: one-shot per pass; both passes authorized.
- Preserve public Mixcloud image output; no uploads or backfill.
- [x] Pass 1: rename show URL columns and admin contracts, update
      callers/docs/tests.
- [x] Pass 2: add nullable paired bytea columns; exclude bytes from JSON.
- [x] Verify migrations, show flows, exports, types, build, lint, docs, browser
      views.
- User review: pending.

## Verification

- Passed typecheck, admin build, lint, and docs checks.
- Passed migration rollback/reapply, paired-image constraints, import/edit/list,
  export, and publication tests against disposable PostgreSQL.
- All 64 selected browser cases passed across the initial run and focused rerun.
- Inspected show forms at desktop and phone widths.
- Existing unrelated message-modal unit test fails on HTML attribute ordering.
- Application migrations were applied only to the disposable test database.
- Uploads, image serving, and backfill remain out of scope.
- Implementation was committed during the session as `fb3ac39`; an additional
  export fixture assertion remains in the working tree.
