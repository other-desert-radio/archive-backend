# Duration inputs and initial tracklist row

- Mode: one-shot, authorized by “do it”.
- Scope: shared duration control, tracklist time parsing/formatting reuse, form
  initialization and submission, affected tests and UI guide.
- Duration input uses m:ss or h:mm:ss as placeholder only; API/storage retain
  integer seconds. Read-only durations keep current clock formatting.
- Add tracklist starts with one blank song row and visible actions; untouched
  opening is clean.
- [x] Implement controls and update affected callers.
- [x] Update focused tests and authoritative UI guidance.
- [x] Run focused checks and authenticated browser acceptance at desktop, 390px,
      and 320px.
- User review remains pending.

- Validation: 185 admin UI unit tests passed; typecheck, build, lint, and docs
  checks passed. Duration/edit/import, tracklist, and uploaded-show browser
  checks passed at desktop, 390px, and 320px.
- Browser run: 93/98 initially passed. Three stale relationship selectors were
  corrected and passed on rerun. Image-crop Escape passed when rerun alone.
  Unrelated tag-helper spacing check still fails (selector returns no
  box/helper, measured gap -1 instead of 8); no tag component changes made.
- Agent-browser and screenshot inspection confirmed the placeholder-only empty
  duration, pluralized filled helper, and one-row Add tracklist layout.
- Implementation complete; user review remains pending.
