# Mixcloud upload, review, and save

## Status

Implementation and automated verification complete. User visual acceptance and
live end-to-end Mixcloud verification remain unconfirmed. The user reports
migration 0039 applied; no regular database changes were made for testing.

## Decisions and implementation

- Began in substantial chunks; the user authorized finishing the remaining UI.
- Receive MP3/image and editorial fields, upload to Mixcloud, retain the
  returned cloudcast key in mixcloud_uploads, and confirm upload to the browser.
- Prepare fetches a single cloudcast with validated metadata, fixed API origin,
  bounded timeout, redirect rejection, and no token or automatic retry.
- Review Show edits our title, description, date, and DJs. Provider duration,
  tags, URL, and image URLs come from the stored validated snapshot.
- Save locks the upload and source row, reuses the import transaction, and
  commits the Show, relationships, source markers, and upload link together.
  Replays return the existing Show; concurrent import/upload saves create one.
- Shared persistence writes description and preserves it when other callers omit
  the field. Media remains temporary and is removed after upload.
- Upload confirmation transitions to preparation, explicit review, then a
  persistent Show saved modal containing actual returned database fields.
- Fetch/save retries never repeat media upload; failed saves retain review
  edits. Resource reload errors preserve success and offer Reload lists.
- Reuse existing modal shells, form fields, DJ picker, formatting, and focus
  handling. Success focuses its top close button to keep the heading visible.
- All upload handlers live under the Mixcloud routes/upload folder.
- Durable attempts, toolbar queue, and reload/resume remain deferred in the
  [future recovery plan](../future/mixcloud-upload-recovery.md). Closing the
  current flow can leave an upload without an archive Show or resume UI.

## Interfaces

- POST /api/admin/mixcloud/upload returns success, uploadId, key, and URL after
  provider upload and pending-record persistence. If the provider succeeded but
  persistence failed, return an explicit uploaded marker and advise no reupload.
- POST /api/admin/mixcloud/uploads/:id/prepare returns editorial review fields
  and fetched Mixcloud metadata, storing the snapshot without creating a Show.
- POST /api/admin/mixcloud/uploads/:id/save accepts title, description, date,
  and DJ IDs; returns 201 with the new Show or 200 with the already saved Show.

## Verification

- Backend: 144 regression checks plus disposable PostgreSQL API/storage checks
  for rollback, migration reapply, replay, concurrent save, and import races.
- UI: all 147 admin UI unit tests passed, including focused prepare/save loader
  validation and the shared message-modal checks. Typecheck, admin build, lint,
  docs:check, and whitespace checks passed.
- Ten mocked browser scenarios cover desktop/390px/320px, one upload across
  retries, pending upload/save locks, persisted success data, missing labels,
  post-save reload failure, obsolete prepare responses, dirty dismissal, focus
  restoration, and existing manual create/edit behavior.
- Agent-browser independently exercised upload/review/save with mocked APIs;
  desktop/390px/320px review and success screenshots were captured and visually
  inspected. All browser checks used the isolated local preview.
- No live Mixcloud writes, production migrations, or real archive test records.
- Recovery is intentionally not implemented. User review was not marked done.
