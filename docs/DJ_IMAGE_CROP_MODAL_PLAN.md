# DJ Image Crop Modal Plan

## Summary

Keep the DJ onboarding modal mounted and visible while a second crop modal opens
above it. Validate and decode the selected image before opening the crop modal,
so source-file errors remain on the DJ modal. The crop modal supports square
cropping, zooming, dragging, and 90-degree rotation.

The browser exports only a 1200-by-1200 WebP at 90% quality. Originals are not
retained, and no backend or database changes are required.

Implement one chunk at a time. Complete its tests, documentation, and visual
verification, then stop for review before beginning the next chunk.

## Checklist

### Chunk 1: Layered square crop and zoom

- [x] Add `react-easy-crop` and lock its compatible package version.
- [x] Validate JPEG, PNG, or WebP type, matching extension, and the 10 MiB limit
      before opening the crop modal.
- [x] Decode the source image before opening the crop modal; show unreadable
      image errors beside the DJ dropzone.
- [x] Open the crop modal from both file-picker selection and drag-and-drop.
- [x] Keep the populated DJ modal mounted beneath the crop modal.
- [x] Give the crop modal a higher backdrop and panel layer than the DJ modal.
- [x] Make only the top modal interactive:
  - [x] Mark the covered DJ dialog inert and hidden from assistive technology.
  - [x] Suspend the DJ modal's focus trap, Escape handler, close action, and
        form submission.
  - [x] Restore interaction and focus when the crop modal closes.
- [x] Display a visible square crop boundary with drag-to-position behavior.
- [x] Add an accessible zoom slider from 1x to 3x.
- [x] Add Cancel and `Use image` actions.
- [x] On cancel, discard the new candidate while preserving all DJ fields and
      any previously confirmed image.
- [x] On confirmation, export a 1200-by-1200 `image/webp` at 0.9 quality, named
      from the original stem with a `.webp` extension.
- [x] Allow smaller source images to upscale to 1200 by 1200.
- [x] Revalidate the generated file before storing it in the DJ form.
- [x] Surface unexpected canvas or WebP encoding errors inside the crop modal
      without losing the crop.
- [x] Revoke temporary object URLs and allow the same source file to be selected
      again.
- [ ] Add focused tests for pre-modal validation, decoding failure, filename
      conversion, output metadata, crop geometry, cancellation, and
      replacement-image behavior.
- [ ] Document the layered modal workflow and browser-side WebP normalization.
- [ ] Run focused tests, type checking, linting, and the production admin build.
- [ ] Use authenticated `agent-browser` verification on `#djs` to inspect both
      modal layers, drag and zoom an image, cancel once, and confirm once.
- [ ] Stop for review before Chunk 2.

### Chunk 2: Quarter-turn rotation

- [x] Add `Rotate left` and `Rotate right` controls.
- [x] Change rotation only in 90-degree increments and normalize the stored
      rotation to 0, 90, 180, or 270 degrees.
- [x] Recalculate the crop constraints after each rotation so horizontal and
      vertical images continue covering the entire square boundary.
- [x] Apply the same quarter-turn rotation during canvas export so the result
      matches the preview.
- [x] Reset crop position, zoom, and rotation when a different source image is
      selected or the DJ modal is reopened.
- [x] Add focused export-geometry tests for 0, 90, 180, and 270 degrees.
- [ ] Test portrait, landscape, JPEG, PNG, WebP, and undersized sources.
- [x] Confirm the final multipart DJ request contains the generated WebP rather
      than the source file.
- [x] Update documentation for quarter-turn rotation behavior.
- [ ] Run the complete test suite, type checking, linting, and production admin
      build.
- [ ] Use authenticated `agent-browser` verification to rotate a horizontal
      image into portrait orientation, reposition and zoom it, confirm the crop,
      and verify the underlying DJ form retained its values.
- [ ] Stop for final review.

## Interfaces and behavior

- Add an optional covered or obscured state to the shared onboarding modal so
  the DJ modal can remain mounted without responding to input while the crop
  modal is active.
- `CreateDJForm.image` remains a browser `File`, containing the generated WebP
  after confirmation.
- `POST /api/admin/create-dj`, its multipart field names, database schema, and
  server storage behavior remain unchanged.
- Source-file and decode errors appear on the DJ modal before the crop modal
  opens.
- Final DJ submission failures appear on the DJ modal because the crop modal has
  already completed.
- The server does not crop, rotate, retain originals, or enforce square
  dimensions in this iteration.

## Acceptance criteria

- Valid picker and drop selections open a second modal above the populated DJ
  modal.
- Invalid, oversized, or unreadable images never open the crop modal.
- The underlying DJ modal stays visible but cannot receive focus or interaction.
- Escape and Cancel close only the crop modal and preserve the DJ form.
- Rotation occurs only in 90-degree increments.
- The crop boundary never exposes space outside the image.
- Every confirmed result is a 1200-by-1200 WebP whose content matches the
  preview.
- Existing DJ submission and backend validation continue working without API
  changes.
