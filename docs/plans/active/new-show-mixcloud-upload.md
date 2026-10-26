# New-show Mixcloud upload

Use the seven user-approved chunks, with review after each. No archive creation
or artwork upload. Retrieve the stored OAuth token server-side, never in the UI.

1. New-show title, date, tags; disabled submit — implemented, verification
   pending. User review pending. Existing-show and edit behavior remain
   available.
2. Plain authentication text: signed in as X via Mixcloud — pending.
3. Move reusable DJ dropzone to shared; add MP3 selection — pending.
4. Present upload route scaffolding/contracts — pending.
5. Build scaffolding — pending.
6. Parse/validate multipart and handle MP3 temporary files — pending.
7. Upload to Mixcloud, log full response with credentials redacted, return a
   success boolean — pending.

Future: server-side orchestration calls shared archive creation after upload;
retain provider identifier so archive creation can retry without reuploading.
Date is show metadata, not scheduling. Public upload; no automatic retries.

Next: finish chunk 1 checks and obtain user review before chunk 2.
