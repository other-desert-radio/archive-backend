# Mixcloud cover art

## Decisions

- User requested five chunks and shared artist/show image components.
- Reuse square 1200 × 1200 WebP cropping, rotation, and preview.
- Preserve unrelated edits. Never retry a live upload automatically.

## Checkpoints

1. Shared image extraction and DJ migration: implemented; user review pending.
2. Show form integration using shared picker/crop: pending.
3. Browser multipart and backend image validation/cleanup: pending.
4. Forward WebP picture to Mixcloud with provider tests: pending.
5. Integrated verification, docs, and user live WebP verification: pending.

## Current chunk

Moved `dj/image` to `shared/modal/image`, removed DJ names, made dropzone
ID/name caller-owned and crop IDs unique. Selection reset takes a caller-owned
key instead of a DJ record contract. DJ create/edit use shared exports. Existing
image behavior and 1200px square WebP output remain unchanged.

## Next action

Wait for user review before show form integration. Live WebP acceptance is
unknown.
