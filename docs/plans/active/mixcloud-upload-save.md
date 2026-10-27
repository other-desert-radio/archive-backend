# Mixcloud upload, review, and save

## Status

Chunked mode, with substantial responsibility groups. Unit 1 is reviewed; the
user reports migration 0039 applied. Unit 2 structure and scaffolding are
approved; implementation is complete and user review is pending. Unit 3 has not
started. No independent inspection of the user's migration state was performed.

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

## Unit 2 structure proposal

New files:

- src/mixcloud/cloudcast.ts: shared cloudcast validation/types, moved from the
  import route types so provider transport does not depend on admin routes.
- src/admin/routes/mixcloud/routes/upload/prepare-uploaded-show.ts: prepare
  handler; load the pending record, fetch its cloudcast, store the validated
  snapshot, and return review fields.
- src/admin/routes/mixcloud/routes/upload/save-uploaded-show.ts: save handler;
  validate reviewed editorial fields and return the committed Show.
- tests/admin/uploaded-show.test.ts: prepare/save API boundary coverage.

Extend existing modules:

- Mixcloud client/index and import route types: single-cloudcast fetch using a
  validated key, fixed API origin, timeout, and shared cloudcast pattern.
- Upload storage: read pending records, retain fetched snapshots, and save a
  reviewed upload transactionally. Provider-owned fields come from the stored
  validated snapshot, never from the browser's save payload.
- Mixcloud route types/registration: POST uploads/:id/prepare and
  uploads/:id/save under /api/admin/mixcloud, with existing admin protections.
- Show normalization/persistence: optional description, preserving existing
  descriptions when omitted by other callers.
- import-show.ts: expose its existing transaction-level import operation for
  reuse; include description on replay. Reuse source-row locking, relationship
  creation, and persistMixcloudEntry instead of a second import implementation.
- Existing client, database upload/import, normalization, and persistence tests,
  plus authoritative API/database references.

Flow: pending ID → fetch cloudcast → persist snapshot → review response.
Explicit Save: lock upload → return prior saved Show on replay, or validate
editorial fields and stored snapshot → persist/lock source tracking → reuse
transactional import → link upload → commit → return Show.

Save accepts our title, description, date, and DJ IDs only. Duration, image
URLs, show URL, and tags come from fetched Mixcloud data. Creating the Show,
relationships, import marker, and upload link is one transaction. Existing
imports and uploaded saves serialize on the same source row. An already imported
source returns its saved Show without overwriting it. No provider requests or
uploads occur during Save. No new migration is needed.

## Unit 2 implementation

- Registered prepare/save endpoints under the existing upload handler folder.
- Single-cloudcast reads use a fixed provider origin, bounded timeout, redirect
  rejection, validated key/metadata, and safe errors; no token or media upload.
- Prepare stores a snapshot and returns our editorial fields alongside fetched
  metadata. It creates no Show and does not advance publication state.
- Save locks the upload, uses provider fields only from the stored snapshot, and
  reuses source persistence plus the extracted import transaction.
- Source-row locking prevents duplicate Shows across import and upload flows.
  Repeated saves return persisted fields; failed writes roll back every marker,
  relationship, tag/Show creation, and publication revision change.
- Shared persistence writes optional descriptions and preserves them when
  existing callers omit the field. Replay responses include description.
- UI wiring and final browser acceptance remain in unit 3. No new migration.

## Unit 2 verification

- Disposable PostgreSQL API/storage tests passed for review mapping, invalid
  metadata, validation, omitted-description preservation, transaction rollback,
  concurrent save replay, and racing upload/import saves.
- Existing import transaction and upload migration/storage tests passed against
  that disposable database. No regular database writes or live provider calls.
- Client tests cover fixed-origin fetch, key/metadata validation, timeout,
  malformed/failed responses, and no retries.
- 144 focused regression tests passed; the database-gated case was run
  separately with the disposable PostgreSQL checks. Typecheck and admin build
  passed. Repository lint, docs:check, and whitespace checks also passed.
- The temporary database container was stopped and removed after verification.

## Verification and next action

Documentation: run docs:check and focused Markdown lint. Implementation:
typecheck, focused tests, admin build when affected, lint, and required
desktop/phone browser acceptance for the final UI unit. No live uploads or
regular database mutations for verification.

## Unit 1 implementation

- Provider success returns a validated cloudcast key. Receive preserves our
  title, description, date, selected DJs, provider title, and requested tags.
- Route validates DJ existence before uploading, records the pending upload, and
  returns success plus uploadId/key/url. Media cleanup remains mandatory.
- A storage failure after provider success returns an explicit uploaded marker
  and Mixcloud URL; the loader says not to upload again.
- Migration creates the pending table with unique provider keys and nullable
  creator/show foreign keys. No durable attempts or recovery UI were added.
- The browser sends selected DJs and accepts the new reply. The modal still
  closes after confirmation until unit 3 implements the review transition.
- The up/down and storage scaffolding now has executable behavior. Prepare/save
  routes remain deferred to unit 2.

## Verification

- 89 provider, route, loader, OAuth, and admin-boundary regression tests passed.
- Disposable PostgreSQL migration/storage test passed, covering round-trip
  editorial data, unique keys, foreign keys, omitted description, deletion, and
  migration rollback/reapply.
- Typecheck, admin build, repository lint, docs:check, and whitespace checks
  passed. An initial Bun invocation matched Playwright files accidentally;
  rerunning with explicit relative test paths passed all intended checks.
- No live Mixcloud upload, regular database migration, or browser acceptance has
  been performed. Layout and controls are unchanged in this unit; final review
  interactions require browser acceptance in unit 3.

Next: user review of unit 2 implementation, then unit 3 structure.
