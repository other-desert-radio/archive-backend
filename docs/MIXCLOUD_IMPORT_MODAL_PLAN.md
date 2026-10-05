# Mixcloud import modal implementation plan

## Delivery checkpoints

Follow AGENTS.md: implement one small, reviewable chunk, include focused tests
and documentation, then STOP for user review before starting the next chunk. Do
not implement every checkpoint in one pass.

1. Tag key resolution route, shared contracts, loader, and focused tests.
2. Import-aware Show creation and transactional persistence, after the image
   migration/API dependency lands; include real-database tests.
3. Minimal shared modal extensions and helper support, with regression tests.
4. Single-row import form, initialization, source section, and form tests.
5. Category queue wiring, counts, navigation, and browser integration tests.

Checkpoint 1 implements resolution only; no import or UI workflow is enabled.

### Handoff status

Checkpoints 1 and 2 are complete. Checkpoint 2 awaits review; start checkpoint 3
only after review. Do not repeat the Figma read.

Checkpoint 2 extends Show creation with optional `mixcloud_import_id`, locks the
tracking row, and commits Show metadata, relationships, tags, and import markers
in one transaction. Repeats return the existing Show without writes. Disposable
PostgreSQL coverage checks concurrent requests and rollback after a forced
tracking-update failure, plus metadata/image mapping and validation.

The merged image dependency differs from the original nullable assumption:
migration `0023` and the ordinary Show API require both image URLs. Imports keep
that contract; absent images return `400`. Migration `0024` removes the legacy
Show `image` column; JSON compatibility maps `image` from `image_large`. The
repeat-request test rejects all attempted writes using database triggers.

Verification: 38 focused tests passed (including real PostgreSQL import and
column-removal/rollback tests), TypeScript, repository lint, and admin build
passed. Lint reports the existing oversized `src/res/mixcloud.json` warning. No
UI behavior changed, so browser acceptance remains required for the later UI
checkpoints.

## Design reference and reuse

Reference:
[Figma node 318:762](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=318-762).
One MCP design-context call returned code and screenshot. Future agents should
use this specification without further MCP calls.

Reuse the existing `OnboardingModal` object. Its overlay, panel sizing,
responsive behavior, padding, typography, focus management, and dismissal
behavior come from the existing component. The reference measurements below
explain composition, not a new fixed-position modal implementation.

### Exact reference geometry

Coordinates use the Figma canvas origin. The pale gray/white textured background
image starts at (0, 0), measuring 1280 by 1006. Preserve the existing
application background rather than embedding the Figma page screenshot.

The main white panel starts at (278, 72), measuring 696 by 704, with a thin
solid black border, square corners, and no shadow. “Import Show” starts at (305,
94), Space Mono Bold 20px, in a 271 by 29 text area. The example count “29
remaining” starts at (800, 93), Space Mono Regular 20px, in a 157 by 29 area at
the upper right.

The white source box starts at (323, 158), measuring 602 by 199, with a thin
dashed black border. “MIXCLOUD DATA” is uppercase, centered near x=624 at y=147,
Space Mono Regular 12px. A white patch behind the legend interrupts the top
dashed border. Labels are right aligned around x=328–438; values start at x=465.
Both use black Space Mono Regular 12px. Example rows are title at y=194, URL at
y=227, key at y=287, and created_time at y=320. The URL wraps across multiple
lines. The example title is “ODR LIVE from UP ON THE SUN RECORDS, September 13,
2020”; timestamp is “2026-09-21 06:12:56 UTC”. Render one title value; duplicate
overlapping title layers are a Figma artifact.

The editable form follows the source box. Labels align with the source label
column. Order is title, date, DJs, tags, duration. Reference input outlines
start at x=476, measure 471 by 25, and have top positions y=391, 424, 454, 482,
and 515. Save is an outlined white 54 by 25 button at (565, 650), with centered
12px text. Skip is borderless centered text beneath it near y=686. There is
generous whitespace around the actions. No image preview, left arrow, or
separate editable-section heading appears.

The next-arrow button is a white 51 by 51 square at (1054, 336), thin black
border. Its black right-pointing arrow sits near (1069, 351), measuring 23 by
25.5. Keep the action within the dialog's focus boundary despite its desktop
placement outside the panel.

### Agreed adaptations

Use reviewed repository modal defaults: at least 14px form text, 12px helpers,
42px minimum controls, existing dimensions/padding/spacing, existing Save
classes and hover behavior. Source content determines height; do not impose
Figma's 199px source-box height or truncate values.

Extend the modal with optional header content, navigation action, guarded
secondary action, and post-submit callback. Existing callers retain their
current behavior. Show the count alongside the existing Close control. Skip uses
Cancel styling. The arrow appears beside the panel on desktop and inside
viewport bounds on phones. Preserve focus containment and dismissal controls.

Share Show form fields/state/validation with `ShowFormModal`; extract focused
pieces where needed rather than introduce numerous import-specific mode flags.
Reuse `SearchableMultiSelect`, `TagsInput`, `LabeledFormControl`, tag loading,
and relationship-aware dirty comparison. Add optional helper content under
DJ/tag controls with consistent styles, spacing, and accessible descriptions. On
phones, stack labels above values/controls, wrap long URLs, and keep actions
reachable through vertical scrolling. Follow existing component/barrel
ownership.

### MIXCLOUD DATA contents

Display only these read-only fields, in order: id, name, url, key, created_time,
duration, mixcloud_tag_keys, show_id. Label source name as name. Use UTC
timestamps, existing duration/array formatters, and muted “None” for missing
values. Allow the dashed section to grow with content.

Do not display image_small, image_large, derived_title, derived_date,
decoded_djs, parser_version, parser_key, data_changed, imported_at, show_name,
djs, dj_names, or tags in this section. Do not expand upstream fetching/storage.

## Contracts and persistence

### Tag resolution

Extend authenticated POST `/api/admin/validate-tags`, preserving the existing
`{ tags: string[] }` request and `{ valid: string[], invalid: string[] }`
response. Alternative request: `{ mixcloud_keys: string[] }`. Response:

```ts
{
  valid: Array<{
    key: string;
    tag: { id: number; title: string; color: string };
  }>;
  invalid: string[];
}
```

Match exact stored keys without trimming or case folding. Deduplicate input keys
in first-occurrence order. Missing or ambiguous matches are invalid. Reject
combined variants. Define runtime patterns and inferred shared types beside the
route. Prepopulate canonical titles in existing colored chips. Show unresolved
keys beneath the tags control; do not derive names or automatically create tags
from unresolved keys. Manually entered unknown titles retain tag creation.

The import form calls the existing loader's `resolveMixcloudTags` with the row's
keys, sets selected titles from `valid.map(({ tag }) => tag.title)`, and retains
`invalid` keys for helper text. `TagsInput` uses its normally loaded tag options
to render canonical titles as colored chips; reuse its search, completion,
removal, and draft behavior. Add optional helper content within the existing
control rather than build a separate tag UI. Resolved opening selections belong
to the initial baseline and must not count as unsaved edits.

### Reuse Show creation

Do not add a separate import endpoint. Extend POST `/api/admin/create-show` with
optional positive safe-integer `mixcloud_import_id`. Submit the complete
ordinary create-show payload, including URL and image_small/image_large once the
other branch's migration/API changes land. Validate and persist submitted
values; do not silently replace them from the source row.

`mixcloud_import_id` is request context only, NOT a new column on `shows`. The
relationship remains in the existing `mixcloud_import.show_id` column. Extending
creation lets Show creation and tracking updates commit or roll back together;
do not create first and link with a separate request/transaction.

Depend on the merged required Show image_small/image_large text columns.
Coordinate with the image branch's final request types and existing image-field
compatibility; do not independently redesign ordinary Show image handling or add
its migration. No image downloads are required.

Reuse Show normalization, existing-DJ validation, tag creation, and persistence.
For import requests, lock the tracking row with FOR UPDATE and recheck show_id
before creating anything. Create the Show, relationships, and missing tags, then
set show_id/imported_at together and clear data_changed in the SAME transaction.
Refactor transaction ownership if needed to avoid independently committed inner
transactions.

Normal successful creation retains its admin Show response and 201 status.
Already imported returns 200 with the existing admin Show and performs no
writes. Unknown tracking IDs return 404; invalid inputs/nonexistent selected DJs
return 400; unexpected failures roll back and return generic 500. Ordinary
creation without the optional ID remains unchanged. Add readable lifecycle logs
per api-routes.md.

## Initialization and queue

Title uses derived title when available, otherwise source name. Date uses the
UTC calendar portion of derived date when available, otherwise blank. Duration
uses source duration or starts blank. URL and image URLs initialize from the
source row and enter the full submitted payload, with no extra editable inputs.
Editable order: title, date, DJs, tags, duration (seconds).

Trim decoded DJ names and compare case-insensitively with existing DJ titles.
Select unique exact matches only. Show unmatched/ambiguous names as helper text
under the DJ selector, consistent with tag helpers. Never automatically create
DJs. Resolve source tag keys through the new validation variant.

Wait for initial DJ/tag resolution before establishing the opening baseline and
enabling Save. Failures offer Retry and preserve edits. Ignore obsolete
responses after navigation/closure. Reset values, helpers, errors, selector
search, and baseline between items.

Both category buttons open queues instead of filtering the table. Queue all
pending category rows, independent of table search/sort, in ascending ID order.
Remaining count includes all unimported category rows, including current/skipped
rows. Save decreases it; Skip does not. Skips perform no writes and skipped rows
return when reopening. Arrow and Skip share behavior. Confirm dirty edits before
advancing; clean forms advance immediately. Existing Close/Escape/backdrop
behavior remains. Close automatically after the last session item; show a brief
empty-queue message if a category has no pending rows.

Successful Save and already-imported responses advance. During submission, block
duplicate Save, navigation, and dismissal. Failures retain values and standard
error feedback. Update local tracking state on success, then reload list/counts;
reload failure must not misreport a committed import as failed Save. Disable
background refresh while the modal is open. Preserve table search/sort and
restore focus to the launcher on closure.

## Acceptance tests

Use disposable PostgreSQL per DATABASE_E2E_TESTING.md for persistence tests.
Mock browser mutations when database persistence is not under test.

- Tag resolution: legacy compatibility, canonical matches, missing/ambiguous
  keys, exact matching, duplicates, empty arrays, malformed/combined bodies,
  authentication, database failures, and loader errors.
- Persistence: submitted metadata, exact URL/image mapping, absent-image
  rejection, relationships, missing-tag creation, paired import markers, cleared
  flag, repeat/concurrent requests producing one Show, and rollback after forced
  post-creation failure.
- Browser integration: both categories, ID order despite search/sort, imported
  row exclusion, count semantics, skipped rows returning on reopen, final close,
  empty queue, approved source fields only, long values, initialization,
  unmatched helpers, loading/retry, and stale-response protection.
- Interaction: dirty Skip/arrow confirmation, clean navigation, Close/Escape/
  backdrop, focus containment/restoration, pending-request protection, failed
  Save/retry, and existing create/edit modal regressions.

Run relevant tests, TypeScript, lint, formatting checks, and admin build at each
checkpoint. UI checkpoints require authenticated agent-browser acceptance at
desktop, 390px, and 320px before handoff. Exercise affected controls, layered
confirmations, scrolling, and inspect screenshots. Report runtime blockers.
