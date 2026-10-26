# New-show Mixcloud upload

## Handoff status

All seven requested implementation chunks are implemented. Final user review and
live Mixcloud verification remain pending; do not mark them complete. The user
explicitly owns browser verification: do not run browser checks. Preserve
unrelated local edits; current changes are not committed.

## Completed chunks and decisions

1. New-show mode displays title, show date, tags, and MP3 selection.
   Existing-show onboarding and editing retain their archive fields and save
   behavior.
2. Plain sign-in row says “Signed in as X via Mixcloud”: full width, italic,
   dashed border, bold account name. Loading/disconnected/unconfigured/error
   states are text only; no connection controls in the row.
3. Shared `FileDropzone` lives in `src/admin-ui/components/shared/modal/`. Its
   optional `style` is `square` or `horizontal`; new shows use the horizontal
   three-line-height box with “Drop MP3 or choose file”. DJ wrapper retains
   image validation, preview, and crop behavior. MP3 selection supports
   replacement/removal, filename/byte size, and unsaved-change protection.
4. Upload endpoint structure/contracts reviewed and approved.
5. Route scaffolding implemented; the former HTTP 501 stub is now replaced by
   the actual upload flow described below.
6. Multipart validation and disk streaming implemented. `music-metadata`
   replaces custom signature masks. Real silent MP3/WAV fixtures cover format
   detection, renamed-file rejection, metadata-only rejection, and
   temporary-file cleanup.
7. Provider upload implemented separately, with response diagnostics and safe
   failure messages. Route split requested by user is implemented.

## Current flow and code

- UI: `show-form-modal.tsx` owns the MP3 draft and connected-account state.
  `src/admin-ui/loaders/upload-mixcloud.ts` builds the multipart request using
  `apiFetch`. Submit requires a connected account and selected file. Confirmed
  success closes the modal; failures retain the draft.
- `POST /api/admin/mixcloud/upload` inherits the admin session/trusted-origin
  boundary. Multipart fields: `title`, `date`, `tags` (JSON array), `mp3`.
- `src/admin/routes/mixcloud/routes/upload/receive-upload.ts` validates a real
  calendar date, nonblank title, up to five nonblank tag names, and one nonempty
  `.mp3` up to 4 billion bytes. Streams to private server-owned temporary
  storage and uses `music-metadata` to require MPEG Layer III audio. It does not
  decode the full recording or extract artwork/exact duration.
- `src/admin/routes/mixcloud/routes/upload/upload-mixcloud.ts` owns
  session/token lookup, temporary-file lifetime, provider invocation, response
  logging, and HTTP mapping. Cleanup finishes before responding. A cleanup
  failure after confirmed provider success does not turn success into a
  retryable failure.
- `src/mixcloud/upload.ts` implements the actual provider POST; `client.ts`
  exposes it through the existing Mixcloud client/fetcher. Uses disk-backed
  `openAsBlob` and FormData, a fixed HTTPS endpoint, redirects disabled,
  30-minute timeout, and no automatic retry.
- OAuth token already exists encrypted per archive user in the database. Fetch
  and decrypt server-side per request; do not fetch tokens in the browser.
- Outbound fields: title as `name`, audio as `mp3`, tags as `tags-X-tag`. Omit
  date, artwork, and scheduling. Upload is PUBLIC by default.
- No archive show is created. Date remains form metadata for future archive
  work.

## Responses and logging

- Success: HTTP 200 `{success:true}`; currently requires a successful provider
  HTTP status plus JSON `success:true` without a non-null error.
- Failures: `{success:false}` with 400 validation, 403 disconnected/rejected
  connection, 413 multipart limits, 429 provider rate limit, 500 server error,
  502 unconfirmed/rejected provider result, 503 unconfigured, or 504 timeout.
  Shared authentication failures retain the shared error format.
- Provider response shape has NOT been confirmed against a live upload. Unknown
  responses are logged and treated as unconfirmed; inspect before changing the
  success detector or retrying.
- BACKEND console logs under `[Mixcloud Upload]` include provider HTTP status
  and full response body with acting-token echoes and credential fields
  redacted. No raw request URL, token, audio bytes, or temporary paths are
  logged. Browser console does not receive the full response body.
- Other logs: received bytes, rejection reasons, codec/sample rate/channels,
  cleanup, final status, elapsed time. Network failures without a response have
  no provider response body to log.

## Verification performed

- Typecheck, admin build, Biome/lint, docs checks, and diff whitespace checks
  passed during implementation. Typecheck/docs and focused tests were repeated
  after moving the route files.
- Latest route/provider run: 22 tests passed in
  `tests/admin/mixcloud-upload.test.ts` and `tests/mixcloud/upload.test.ts`.
- Latest shared auth/origin boundary run: 15 tests passed in
  `tests/admin/mixcloud.test.ts`, including upload restrictions.
- Loader and OAuth client tests also passed before the route-only split.
- Browser tests were updated but not run for the completed flow, per user
  request.
- No live Mixcloud upload has been performed. Do not imply production
  acceptance.

## Next actions

1. Let the user review the current UI and perform a deliberate live upload when
   they request it. Rebuild/restart their chosen stack if needed; do not assume
   the running container serves current source.
2. Inspect backend provider-response logs. Confirm actual success/error shapes
   and adjust parsing with a representative mocked regression test if needed.
3. Confirm the show appears on the intended account, and user-facing failure
   behavior preserves drafts. Never automatically retry uncertain results:
   Mixcloud may have published even if the response was lost.
4. Only after user acceptance, archive this plan or retain useful history under
   `docs/plans/archive/`; do not mark user review complete without their input.

## Deferred

Artwork, scheduling, resumable/background uploads, and local archive creation.
For future archive creation, prefer one server-side orchestration endpoint that
calls shared creation logic rather than having the browser coordinate a second
POST or the backend call its own HTTP create route. Persist the provider upload
identifier before local creation so archive retries do not upload again. Retain
show date and obtain duration/default artwork before creating the archive show.
