# Mixcloud upload, review, and save

## Status

Chunked mode, with substantial responsibility groups. Unit 1 is reviewed; the
user reports migration 0039 applied. Unit 2 structure is approved and its
scaffolding is ready for review. Unit 3 has not started. No independent
inspection of the user's migration state has been performed.

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

Unit 2 scaffolding is now present. Shared cloudcast patterns/types have moved
unchanged into the provider module, with compatibility re-exports for existing
imports. The client exposes getCloudcast, and upload storage exposes read,
snapshot, and reviewed-save entry points. New prepare/save handlers are not
registered. These six functions explicitly throw Not implemented until the
implementation checkpoint; live upload and existing import behavior remains
unchanged. Show normalization and import transaction extraction wait for that
implementation rather than introducing a parallel unfinished path.

Review contract: uploadId plus editorial title/description/date/DJ IDs and the
fetched cloudcast. Save accepts only editorial fields, returns the committed
Show, and distinguishes first creation (201) from replay (200). Invalid input
returns 400, unknown uploads 404, and missing prepared metadata 409. Prepare
rejects completed uploads with 409, disabled integration with 503, and invalid
or unavailable provider metadata with 502/504.

No schema changes or UI changes are included in this checkpoint.

Scaffolding checks passed: typecheck, lint, docs:check, whitespace checks, and
99 existing client, cloudcast validation/parser, and upload route regressions.
No assertions exercise unfinished stubs; new behavior tests arrive with
implementation. No database or browser checks were run for this checkpoint.

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

Next: user review of unit 2 scaffolding, then implementation.
