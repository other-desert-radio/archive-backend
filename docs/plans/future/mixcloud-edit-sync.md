# Sync archive edits back to Mixcloud

## Status and intent

Future implementation plan; no sync code has been implemented. Save archive
edits immediately and queue durable Mixcloud updates using the editing user's
connected account. Show pending, synced, or failed status and allow retry.

## Intended behavior

- Show edits sync the generated title (DJs + show title + broadcast date),
  description, and complete current tag selection.
- Renaming a tag queues tag updates for every linked show. Deleting a tag
  captures affected show IDs before cascading relationships disappear, then
  queues their remaining tags. Tag-driven updates send only tags.
- Color, review status, and genre source metadata changes do not trigger sync.
- More than five tags blocks that show's sync with an actionable error; the
  archive save still succeeds. Never silently discard tags.
- Use the editing user's connection. Missing connections or ownership mismatches
  block sync with a clear reason.
- Start with future edits, without automatic historical backfill. Archive values
  are authoritative for submitted fields and can overwrite direct Mixcloud
  edits.
- Defer artwork, tracklists, audio, duration, show deletion, and standalone DJ
  edits. Local show deletion cancels pending work without deleting remote
  uploads.

## Implementation

### Provider client and mapping

- Add a bounded metadata edit operation to the existing Mixcloud client,
  retaining injected transport, input validation, and safe error handling.
- Move the existing generated title formatter to a shared utility. Reuse the
  existing safe HTML-to-plain-text conversion for descriptions.
- Resolve cloudcast identity from existing import/upload linkage, falling back
  to a strictly validated Mixcloud show URL. Never send tokens to a supplied
  origin. Check the cloudcast owner against the user's connected identity.
- Send complete tag sets: the provider replaces submitted tags wholesale.
  Establish and verify how to clear every tag before enabling deletion sync; the
  documentation does not explicitly specify the empty-tag case.

Provider reference:
[Mixcloud API documentation](https://www.mixcloud.com/developers/).

### Durable queue

- Add PostgreSQL sync state containing show/provider identity, requesting user,
  pending field groups, desired/completed revisions, retry timing, attempts, and
  sanitized failure information.
- Persist queue changes in the same transaction as show/tag edits. Rollback must
  leave neither partial edits nor orphaned requests.
- Coalesce repeated edits per show and field group, retaining the responsible
  user for each pending group. Build requests from current persisted data.
- Run a small database-backed worker alongside the API, with one active
  processor per show across instances and restart recovery. Older completions
  must never acknowledge newer edits; newer revisions remain pending.
- Retry network and provider server failures with bounded backoff, honoring
  provider rate-limit delays. Authentication, ownership, validation, and missing
  remote shows require correction and manual retry.
- Resolve credentials when processing; never copy tokens into jobs. Deleted
  users and disconnected accounts leave actionable blocked work.

### API and admin UI

- Preserve existing save response bodies. Add authenticated sync-status and
  retry endpoints; retry accepts a show ID and uses the requesting user's
  current connection with ownership revalidation, never another user's token.
- Show per-show status and retry controls in Shows. After tag changes, explain
  that affected shows have queued updates.
- Keep inbound refresh read-only for approved archive records. Outbound sync
  must not automatically reimport or overwrite reviewed archive data.
- Update existing API, database, and architecture references when implemented.

## Delivery

Use the selected
[chunked development workflow](../../DEVELOPMENT.md#development-modes), applying
structure, scaffolding, and implementation separately to each unit:

1. Provider edit transport and shared metadata mapping.
2. Durable queue and restart-safe worker.
3. Transactional show/tag enqueueing.
4. Status/retry API and admin UI.

Require documented user review at each checkpoint before advancing. The first
unit's file structure has been proposed in conversation but is not approved.
When implementation begins, track progress in an active task plan.

## Acceptance and verification

- Cover show edits, tag assignments, tag rename fan-out, and tag deletion,
  including removal of the final remaining tag.
- Verify no-op edits and local-only tag changes produce no provider writes.
- Cover the five-tag limit, description clearing, title formatting, connection
  failures, ownership checks, and retry authorization.
- Cover atomic rollback, concurrent edits, stale completions, restart recovery,
  multiple instances, rate limits, timeouts, revoked tokens, deleted users, and
  missing remote shows.
- Verify safe logs, status/retry UI, and inbound refresh compatibility.
- Run focused tests, disposable database tests, typecheck, lint, admin build,
  mandatory browser acceptance, and documentation checks.

Live provider writes have not been tested. Clearing all remote tags is a release
gate for deletion sync.
