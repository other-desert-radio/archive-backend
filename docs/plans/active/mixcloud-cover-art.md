# Mixcloud cover art

## Decisions

- User requested five chunks and shared artist/show image components.
- Reuse square 1200 × 1200 WebP cropping, rotation, and preview.
- Preserve unrelated edits. Never retry a live upload automatically.

## Checkpoints

1. Shared image extraction and DJ migration: reviewed; user requested next
   chunk.
2. Show form integration using shared picker/crop: implemented; user review
   pending.
3. Browser multipart and backend image validation/cleanup: pending.
4. Forward WebP picture to Mixcloud with provider tests: pending.
5. Integrated verification, docs, and user live WebP verification: pending.

## Current chunk

New-show mode uses shared ImageDropzone, ImageCropModal, and useImageSelection.
Accepted artwork remains in the draft when replacing/canceling or switching
modes; removal clears selection and errors. Image drafts trigger discard
confirmation. Parent modal is covered during cropping. Existing-show/edit fields
remain unchanged. Shared selection hook exposes removeImage.

Artwork is not sent yet; multipart and backend integration are chunk 3.

## Verification

- Typecheck and admin build passed.
- Ten focused Playwright cases passed, including crop/rotation/zoom, WebP
  filename, 1200px square preview, Escape cancellation, removal, and discard
  protection at 1280px, 390px, and 320px.
- Screenshots captured; desktop and 320px preview inspected. Agent-browser
  opened the disposable authenticated new-show form and captured its layout.
- No live uploads performed.

## Next action

Wait for approval of chunk 2 before browser/backend multipart integration. Live
WebP acceptance is unknown.
