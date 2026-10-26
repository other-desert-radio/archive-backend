# Nested endpoint route layout

User requested one-shot continuation and integration testing.

- [x] Inspect existing endpoint files, barrels, callers, and test runner.
- [x] Move endpoint handlers into each resource's routes/ directory.
- [x] Rename registration files to *-routes.ts and update all imports/docs.
- [ ] Run typecheck, lint, docs checks, and integration tests.

Keep shared helpers/types at the resource root and preserve endpoint behavior.
Include auth, account, status, health, and public asset registrations.
Verification: typecheck, lint, and docs checks passed. All 237 focused tests
passed after rerunning three sandbox-blocked SSE tests with socket access.
Integration: all 6 auth tests pass after correcting stale Account-dialog and
password-status-column assertions. Remaining 176 browser tests are running.
Next: inspect test results and clean up this disposable plan.
