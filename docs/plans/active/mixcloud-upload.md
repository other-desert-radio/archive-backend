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

- [ ] 1a.1 Create upload page titled MIXCLOUD UPLOAD using existing styling.
      Structure approved; UploadPage scaffolded and kept off live routes.
      Awaiting scaffolding review before implementing the title and page layout.
- [ ] 1a.2 Connect page to #upload.
- [ ] 1a.3 Add UTILS → upload with active-link styling.
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

After scaffolding approval, implement only the UploadPage title and layout. No
route, sidebar, or banner changes yet.
