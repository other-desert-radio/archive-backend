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
5. Build scaffolding — implemented; user review pending. Registered POST route
   returns HTTP 501 with success false; no parsing, token access, or provider
   calls.
6. Parse/validate multipart and handle MP3 temporary files — pending.
7. Upload to Mixcloud, log full response with credentials redacted, return a
   success boolean — pending.

Future: server-side orchestration calls shared archive creation after upload;
retain provider identifier so archive creation can retry without reuploading.
Date is show metadata, not scheduling. Public upload; no automatic retries.

Next: obtain chunk 5 review before implementing multipart handling. Browser
verification is user-owned by explicit request; do not run browser checks.
