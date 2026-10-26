# New-show Mixcloud upload

Use the seven user-approved chunks, with review after each. No archive creation
or artwork upload. Retrieve the stored OAuth token server-side, never in the UI.

1. New-show title, date, tags; disabled submit — complete, user approved.
   Typecheck, build, lint, and docs checks passed. Browser verification is
   user-owned. Existing-show and edit behavior remain available.
2. Plain authentication text: signed in as X via Mixcloud — user approved;
   full-width italic border row, account name now bold. Reuses status loader; no
   credentials or connection controls.
3. Move reusable DJ dropzone to shared; add MP3 selection — user approved.
   Shared square/horizontal variants; MP3 uses a horizontal three-line box. DJ
   wrapper retains image validation/preview. MP3 validation unit tests pass;
   browser checks intentionally left to user.
4. Present upload route scaffolding/contracts — complete, user approved.
5. Build scaffolding — complete, user approved. Registered POST route returns
   HTTP 501 with success false; no parsing, token access, or provider calls.
6. Parse/validate multipart and handle MP3 temporary files — implemented; user
   review pending. UI posts metadata/audio; valid requests return 501 and retain
   the draft. Private temporary files are removed before responding. Replaced
   signature bit masks with music-metadata; real MP3/WAV fixtures cover format
   detection and metadata-only rejection.
7. Upload to Mixcloud, log full response with credentials redacted, return a
   success boolean — pending. Provider HTTP upload must live in a new file,
   `src/mixcloud/upload.ts`; the route owns session/token lookup, validation,
   response mapping, and temporary-file cleanup.

Future: server-side orchestration calls shared archive creation after upload;
retain provider identifier so archive creation can retry without reuploading.
Date is show metadata, not scheduling. Public upload; no automatic retries.

Next: obtain chunk 6 review before connecting the Mixcloud API. Browser
verification is user-owned by explicit request; do not run browser checks.
