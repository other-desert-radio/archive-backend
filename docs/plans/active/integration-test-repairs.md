# Integration test repairs

Continuation of one-shot route work; user requested fixing the 11 failures.

- [x] Inspect failure logs, tests, and current UI conventions.
- [x] Update stale Save, import title, empty-queue, and sidebar expectations.
- [x] Preserve persistence, preview, review, race, and layout coverage.
- [ ] Run lint/typecheck and the full disposable integration suite.

No UI behavior changes planned. Preserve unrelated route-plan deletion. First
rerun: 180 passed, two assertion issues remained (rendered versus DOM text
comparison; Account button precedes sidebar in keyboard order). Corrected both.
Final full disposable suite is running. Next: inspect final results, then remove
this disposable plan.
