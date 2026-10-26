# Mixcloud cover art

## Status

Inactive and archived at the user’s request. Implementation and automated checks
are complete; user acceptance and live Mixcloud WebP/description verification
remain unconfirmed.

## Decisions

- User requested five chunks and shared artist/show image components.
- Reuse square 1200 × 1200 WebP cropping, rotation, and preview.
- Preserve unrelated edits. Never retry a live upload automatically.

## Checkpoints

1. Shared image extraction and DJ migration: reviewed; user requested next
   chunk.
2. Show form integration using shared picker/crop: reviewed; user requested next
   chunk.
3. Browser multipart and backend image validation/cleanup: reviewed; user
   requested next chunk.
4. Forward WebP picture to Mixcloud with provider tests: implemented; user
   review pending.
5. Integrated verification, docs, and user live WebP verification: pending.

## Current chunk

Provider upload now attaches optional imagePath as a disk-backed WebP Blob in
multipart picture, with filename cover.webp and MIME type image/webp. Bytes are
preserved without conversion. Audio-only requests omit picture. The existing
provider response validation, no-retry behavior, and route cleanup still apply.

## Verification

- 37 focused tests, typecheck, lint, and documentation checks passed.
- Provider test generates a real 1200px WebP and verifies exact bytes, filename,
  MIME type, audio and metadata in the outgoing multipart request.
- No live uploads performed. Mixcloud WebP acceptance is unknown.

## Remaining verification

If work resumes, rebuild the selected running stack before live verification.
Confirm Mixcloud accepts WebP artwork and displays the description; user review
has not been marked complete.

## Description follow-up (one-shot)

User separately authorized an optional new-show description field and full
Mixcloud forwarding in one shot while they verify live artwork. Implemented
using LabeledFormControl textarea, with a 1000-character browser/backend limit,
paragraph break preservation, discard protection, optional loader/provider
contracts, and multipart description forwarding. Shared textarea now honors its
existing minLength/maxLength props. No archive schema changes.

Focused route/loader/provider checks: 38 tests passed. Browser verification uses
the disposable stack only; the user's upload stack is unchanged. Ten browser
cases passed at desktop, 390px, and 320px; desktop/mobile screenshots were
inspected. Typecheck, admin build, lint, and docs checks passed. No live
description upload was performed.
