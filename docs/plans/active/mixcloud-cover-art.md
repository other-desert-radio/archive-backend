# Mixcloud cover art

## Decisions

- User requested five chunks and shared artist/show image components.
- Reuse square 1200 × 1200 WebP cropping, rotation, and preview.
- Preserve unrelated edits. Never retry a live upload automatically.

## Checkpoints

1. Shared image extraction and DJ migration: reviewed; user requested next
   chunk.
2. Show form integration using shared picker/crop: reviewed; user requested next
   chunk.
3. Browser multipart and backend image validation/cleanup: implemented; user
   review pending.
4. Forward WebP picture to Mixcloud with provider tests: pending.
5. Integrated verification, docs, and user live WebP verification: pending.

## Current chunk

Browser loader sends optional image alongside MP3 and metadata. The backend
streams artwork into the request-owned temporary directory, limits bytes during
streaming to 10 million, checks MIME/extension and actual WebP format, requires
1200 × 1200 single-frame dimensions, and decodes pixels with Sharp. Invalid
artwork returns 400; oversized artwork returns 413. Audio-only uploads work as
before. Validated imagePath is optional on MixcloudUpload and reaches the
client.

Provider transport still omits artwork until chunk 4. Do not live-test artwork
before that implementation is complete.

## Verification

- 36 focused route, browser-loader, and provider tests passed.
- Tests cover image/audio ordering, unchanged WebP bytes at the client,
  invalid/truncated/disguised/non-square/oversized images, duplicates, and
  cleanup after success and provider failure.
- No live uploads performed.

## Next action

Wait for review of chunk 3 before forwarding WebP as Mixcloud picture in
chunk 4. Live WebP acceptance is unknown.
