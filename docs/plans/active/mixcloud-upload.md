# Mixcloud upload

## Decisions

- Work in tiny chunks; each numbered item is a separate review checkpoint.
- Follow structure → scaffolding → implementation gates within each item.
- Preserve the existing Mixcloud import page and navigation.
- Banner accepts generic leading/trailing React content, uses horizontal flex
  with narrow-screen stacking, and changes from 80% white to white on hover.
- Show only the signed-out state; disable sign-in until OAuth is implemented.
- Defer the outer flex column and separate upload-button div until needed.

## Progress

- [x] 1a.1 Create upload page titled MIXCLOUD UPLOAD using existing styling.
      Title-only page implemented using existing resource-view layout styles.
      User approved with “next”.
- [x] 1a.2 Connect page to #upload. Implemented initial hash and hash-change
      routing; awaiting review. Rebuilt running API container; served bundle
      includes MIXCLOUD UPLOAD. Actual local port is 3000. Browser session
      requires login, blocking authenticated visual acceptance until a signed-in
      session is available.
- [ ] 1a.3 Add UTILS → upload with active-link styling. Implemented and rebuilt
      local container; awaiting user review. Typecheck, focused Biome, 16
      existing tests, and docs checks pass. Browser still shows login;
      authenticated visual acceptance remains open.
- [ ] 1b.1 Create generic Banner with leading/trailing content slots.
- [ ] 1b.2 Add responsive flex layout.
- [ ] 1b.3 Add background and hover styling.
- [ ] 1b.4 Place banner with signed-out text on upload page.
- [ ] 1b.5 Add disabled sign-in button.

## Verification

Run applicable formatting, lint, types, build, and browser checks as chunks
become executable. Inspect desktop, 390px, and 320px layouts. Update the UI
reference when behavior is implemented; run docs:check for documentation edits.

## Next action

Review sidebar chunk 1a.3, then create Banner structure for 1b.1.
