# Duration inputs and initial tracklist row

- Mode: one-shot, authorized by “do it”.
- Scope: shared duration control, tracklist time parsing/formatting reuse, form
  initialization and submission, affected tests and UI guide.
- Duration input uses m:ss or h:mm:ss as placeholder only; API/storage retain
  integer seconds. Read-only durations keep current clock formatting.
- Add tracklist starts with one blank song row and visible actions; untouched
  opening is clean.
- [ ] Implement controls and update affected callers.
- [ ] Update focused tests and authoritative UI guidance.
- [ ] Run focused checks and authenticated browser acceptance at desktop, 390px,
      and 320px.
- User review remains pending.
