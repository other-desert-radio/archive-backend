# Mixcloud upload, review, and save

## Status

Chunked mode, with substantial responsibility groups. Documentation additions
are complete; the first unit's file structure is proposed and awaits approval.
No runtime code or schema changes have been made. User review is incomplete.

## Decisions

- Receive media, upload to Mixcloud, confirm upload to the UI, fetch metadata,
  review using onboarding controls, then save and show persisted data.
- Keep our title, description, date, and selected DJs. Use fetched Mixcloud
  duration, image URLs, show URL, and tags. Review edits affect the archive
  only.
- Store successful uploads in a separate mixcloud_uploads table. Media remains
  temporary; there are no durable upload attempts in this version.
- Group all upload workflow handlers under the existing
  src/admin/routes/mixcloud/routes/upload/ directory.
- Save atomically and return the existing show on replay. Link Mixcloud source
  tracking so the existing import workflow cannot create a duplicate show.
- Defer queue/resume/reconciliation and the ready-to-save toolbar action to
  [future recovery](../future/mixcloud-upload-recovery.md).

## Units

1. Upload key handling, pending table/storage, and upload route integration.
2. Single-cloudcast fetch, review preparation, and atomic reviewed save.
3. Upload confirmation, review UI, and saved-show success modal.

Apply structure, scaffolding, and implementation checkpoints within each unit.
Do not advance a checkpoint without user approval. Group closely coupled work;
do not scaffold later units in advance.

## Current structure proposal

New files:

- src/db/migrations/0039_add_mixcloud_uploads.ts: successful upload draft table.
- src/admin/routes/mixcloud/routes/upload/upload-store.ts: insert successful
  upload metadata and provider key; later units extend this storage boundary.
- tests/db/mixcloud-uploads.test.ts: disposable database migration/storage
  checks.

Existing files to modify in this unit:

- src/mixcloud/upload.ts: validate and return the provider cloudcast key.
- src/db/types.ts: pending upload row type.
- src/admin/routes/mixcloud/routes/upload/receive-upload.ts: retain archive
  title and selected DJ IDs separately from provider transport metadata.
- src/admin/routes/mixcloud/routes/upload/upload-mixcloud.ts: validate selected
  DJs before contacting Mixcloud; record success before responding.
- src/admin/routes/mixcloud/types.ts and mixcloud-routes.ts, plus
  src/admin/admin.ts: database dependency and explicit upload reply contract.
- src/admin-ui/loaders/upload-mixcloud.ts and its form caller: send DJ IDs and
  accept the upload confirmation contract; review navigation belongs to unit 3.
- Existing provider, route, and loader tests: update fixtures and assertions.
- docs/api-routes.md and docs/DATABASES.md: document implemented contracts.

Data flow: validated media/editorial fields → provider upload → validated key →
pending record → upload confirmation. Keep cleanup in the route wrapper and
provider transport in src/mixcloud/upload.ts. No live route uses unfinished
scaffolding. Prepare/save route files are introduced in unit 2.

## Verification and next action

Documentation: run docs:check and focused Markdown lint. Implementation:
typecheck, focused tests, admin build when affected, lint, and required
desktop/phone browser acceptance for the final UI unit. No live uploads or
regular database mutations for verification.

Next: review the first unit's file structure, then request its scaffolding.
