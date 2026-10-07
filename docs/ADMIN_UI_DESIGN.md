# Admin UI design and reuse guide

Read this guide before building or editing admin UI. It records the reviewed
modal design and the reusable components behind it. Follow explicit user
instructions when they differ from these defaults, and update this guide when
reviewed decisions change.

## Aesthetic and readability

Keep the archive's restrained, utilitarian aesthetic: Space Mono, white panels,
black text and square borders, gray hover backgrounds, and colored tag chips.
Use the locally bundled font from `src/admin-ui/assets/fonts/`; inherit its
family in inputs and buttons. Avoid introducing a second font, rounded modal
controls, decorative shadows, gradients, or new accent colors without review.
Existing resource controls outside modals may have their own established styles.

Form and message modal text is at least 14px, with 12px helper text and a 1.5
line height. Use whitespace and bold text for hierarchy. Labels are lowercase
except resource names such as DJs; action labels use plain, concise language.
Keep related instructions next to their control, rather than in a separate form
grid row.

### Sizing and spacing

The shared tokens live in `src/admin-ui/styles.css`. Reuse them instead of
inventing slightly different dimensions for each resource.

- **Panel padding:** 32px desktop; 20px at widths of 450px or less
- **Field spacing:** 20px
- **Desktop label/control gap:** 16px
- **Phone label/control gap:** 8px
- **Title-to-form gap:** 28px
- **Control padding:** 10px vertical, 12px horizontal
- **Control minimum height:** 42px; content can increase it
- **Textarea minimum height:** 96px; vertically resizable
- **Tag box/helper gap:** Explicit 8px vertical flex gap
- **Submit-to-Cancel gap:** 10px
- **Form panel width:** Up to 864px, constrained by viewport; full width on
  phones
- **Message panel width:** Up to 480px, with 16px viewport margins
- **Close target:** 40px square, containing a 24px cross

Desktop forms use label/control columns. Top-align textarea, tag, and DJ
selector labels; retain centered labels for ordinary single-line inputs. At
450px or less, stack each label above its control and allow the panel to scroll
vertically. Keep helpers and inherited tags in the same responsive layout. Check
narrow screens for horizontal overflow and make sure the actions remain
reachable.

### Button states

- Close is a minimal two-stroke cross without a resting border. Hover gives it a
  gray background and thicker strokes.
- Cancel is borderless and becomes bold on hover.
- Submit/Save is bordered text with no resting shadow. Hover moves it 4px up and
  left and adds a 4px black shadow. Use a transform so surrounding layout stays
  fixed; disable its transition for reduced-motion preferences.
- Disabled controls do not apply hover effects. Mouse clicks do not introduce
  extra button focus outlines; keyboard focus remains visible with
  `:focus-visible`.
- Message actions currently use square bordered buttons and gray hover
  backgrounds, with the same font and control sizing. Their semantic primary and
  secondary roles do not currently imply different visual styles.

## Reusable components and ownership

### Floating navigation

On desktop, the black sidebar rests at `left: 2rem`, a top offset of the shared
header height plus `2rem`, with a `10.75rem` width and `1.25rem` padding on
every side. Its height follows the navigation content, keeping top and bottom
padding equal. Shell variables share the sidebar gap, top offset, and width
between resting, expanded, and content styles; the top offset derives from
`--management-header-height`. Hover or keyboard focus expands its background to
the left edge and full viewport height behind the header over 250ms. Navigation
text stays fixed throughout expansion and collapse. Mouse exit collapses the
pane even after clicking a link. Reduced-motion preferences disable the
transition. At widths of 42rem or less, navigation remains a compact full-width
block above the resource content. Links use `⤷` markers, `1.0625rem` text with a
1.5 line height, `0.25rem` vertical padding, `0.5rem` gaps, and a `0.5rem` left
indent. The DATABASE label has a 2px solid white bottom border, `0.5rem` padding
below its text, and a `1rem` gap below it. Active, hovered, and keyboard-focused
links are bold without moving surrounding items.

Keep resource orchestration separate from shared presentation and lifecycle
logic. Extract repeated responsibilities into focused components or hooks; avoid
a generic form framework or components with many unrelated mode flags.

- **`OnboardingModal`:** Shared create/edit form shell, submit lifecycle,
  errors, dismissal, and discard confirmation
- **`MessageModal`:** Caller-supplied title/message and primary, optional
  secondary, and additional actions
- **`LabeledFormControl`:** Label, input/textarea, required and numeric
  constraints, helper/error text
- **`TagsInput`:** Tag chips, draft text, autocomplete, matching options,
  unknown-tag feedback
- **`useTagOptions`:** Existing-tag loading, retry, and ignoring obsolete
  responses after closure
- **`SearchableMultiSelect`:** Searchable existing-resource selection,
  loading/error states, and removable selections
- **`useDialogFocus`:** Internal shared initial focus, Tab containment, Escape
  handling, and optional focus restoration
- **`hasFormChanges`:** Current/opening-value comparison, treating relationship
  arrays as sets
- **`DJMetadataFields`:** Common DJ fields in a consistent order around
  resource-specific controls
- **`EditDJImageField`:** Existing DJ image, replacement, removal/undo, and
  image feedback
- **`useDJImageSelection`:** Decoding, crop candidates, accepted files, removal
  state, and obsolete-work cleanup

Shared primitives live under `components/shared/modal/` or
`components/shared/resource-views/`. Resource components belong under their
responsibility groups, including `dj/onboarding-modal/`,
`shows/onboarding-modal/`, and `dj/image/`. Use one component per subdirectory;
co-locate CSS and private utilities. Every component directory exposes an
`index.ts` barrel. Public consumers import from the highest relevant group
barrel; internal private imports may use a nearer barrel to avoid cycles.

Resource wrappers own field values, opening-value baselines, validation, and
typed request construction. Shared shells should not know resource payloads.
Keep request builders in private resource utilities and leave wire contracts in
the existing loaders/shared API types. The public `OnboardingModal` name remains
in use even for editing.

### Show create/edit reuse

Show onboarding and editing share `ShowFormModal`, including fields, opening
values, validation, tag loading, DJ selection, and unsaved-change comparison.
Small resource wrappers supply empty or existing values and the mutation
callback. Edit controls in both table and grid open the same form. Show cards
require an edit callback so their Edit action cannot silently do nothing. Dates
prefill from the UTC calendar portion of the stored timestamp; duration stays in
integer seconds. All creation fields are editable, and clearing the image URL
removes the image.

Assigned tag titles come from the loaded resource data. If an assigned tag is
unresolved, saving stays disabled until tag loading or Retry resolves it. Late
resolution appends only those opening tags to the selection and baseline without
resetting metadata edits or drafts. Failed saves retain values; successful saves
close directly and refresh Shows, DJs, and tags. Existing Show creation IDs
remain stable, while edit controls use the `edit-show` prefix.

### Optional form navigation and helpers

`OnboardingModal` accepts optional `headerContent`, `secondaryAction`,
`navigationAction`, `previousNavigationAction`, and `onSubmitted`. Header
content sits beside Close and wraps on narrow screens. A secondary action
replaces Cancel using its borderless style and a 42px minimum target. Navigation
renders an accessible arrow beside the panel on wide desktops and below the
scrolling panel on smaller viewports; it remains inside the dialog focus
boundary.

Both optional actions use the same dirty-change confirmation as dismissal. Keep
editing restores focus to the initiating action; Discard runs that action.
Submission disables navigation, secondary actions, and dismissal. `onSubmitted`
replaces automatic closure after a successful mutation so a caller can advance;
the caller owns follow-up reload errors after the committed save. Existing
callers still close automatically.

`SearchableMultiSelect` and `TagsInput` accept optional `helper` content below
the control, with 12px text, wrapping, and accessible descriptions. Additional
tag guidance preserves the existing search/loading/unknown-tag helper. DJ search
spacing stays unchanged when no optional helper is supplied.

The test-only shared-modal fixture exercises these extensions before the import
form is wired. It bundles the real components and is intercepted by Playwright;
no fixture route is registered in the application.

### Single-show Mixcloud import form

`ImportShowModal` reuses shared Show title/date, relationship, and duration
controls and `useShowFormState`/`buildShowFormRequest`. Editable order is title,
date, DJs, tags, duration. Source URL and image variants enter the complete
create-show payload without extra editable controls. Missing required images
produce the existing validation feedback.

The dashed MIXCLOUD DATA section displays only name, url, created_time,
duration, and mixcloud_tag_json. Its height follows content, timestamps use UTC,
and missing/empty values show muted None. Desktop labels reserve room for the
longest field name; phone labels stack and long URLs wrap.

Initial resolution selects unique exact DJ names ignoring case and surrounding
whitespace, and canonical tag titles from source keys. Unmatched DJ names appear
in the selector helper. Matched Mixcloud keys use the database tag title exactly
and its colored chip. Unresolved keys use their original `mixcloud_tags` source
names without lowercasing or slug conversion; existing title matches reuse the
canonical name and color. Remaining new names use the existing red unknown-tag
chips and creation caption, and Save creates them through ordinary Show
creation. Missing source names block Save with refresh guidance rather than
creating tags from keys. Opening selections update the baseline without
resetting typed metadata or tag drafts. Save waits for both resolution and tag
options; Retry preserves edits. Source changes remount the keyed form, resetting
selectors, errors, helpers, and baseline while ignoring stale requests.

The submit button reads “Import”, changing to “Importing…” while submitting. The
form calls the ordinary creation loader with `mixcloud_import_id` and reports
successful 201 or already-imported 200 results to its caller. Category launchers
open the corresponding pending queue.

### Message modal contract

Supply `title`, `message`, `primaryAction`, and `onDismiss`. Each action
supplies `label`, `onClick`, and an optional `disabled` state. `secondaryAction`
and `additionalActions` are optional. Choose `initialFocus` as `primary` or
`secondary`; the default is primary, with fallback to an enabled action or the
panel. Choose `role="alertdialog"` for a discard warning; ordinary messages
default to `dialog`.

The caller owns whether the message is mounted, the effect of each action, and
restoring focus after dismissal. It must make the underlying form inert when
layering a message above it. `OnboardingModal` already does this for discard
confirmation. Do not add static-container click handlers with accessibility lint
suppressions: the current backdrops use native buttons outside the panels,
excluded from Tab order, alongside Escape handling.

## Interaction decisions to preserve

The shared resource toolbar stays sticky below the fixed management header while
DJ and Show tables/grids and Tags tables/grids scroll underneath. Its gray
background and solid bottom border appear only when it sticks. The header height
and sticky offset share a whole-pixel CSS variable to avoid a gap. Its stacking
order keeps controls above scrolling content. Search can shrink to fit narrow
screens.

Form dialogs sit above the management header and toolbar. Discard confirmations
and image crop dialogs sit above the form so toolbar controls cannot intercept
dialog actions.

Cancel, Close, Escape, and the form backdrop share one dismissal path. Clean
forms close immediately. Dirty forms show “Discard unsaved changes?” with “Keep
editing” initially focused and “Discard changes” as the primary action. Escape
and the confirmation backdrop keep editing. Preserve values and restore focus to
the initiating control, or the form panel if necessary.

Dirty state means current values differ from opening values; reverting values
clears it. Count tag drafts, tag/relationship membership, accepted image
changes, and image removal. Exclude loading, errors, and selector search text.
Successful submission closes directly, while failed submission retains values.
Block dismissal during submission and while the separate DJ crop dialog covers
the parent. Preserve the crop dialog's own interaction behavior.

DJ create/edit and Show create use the same `TagsInput` and loading hook. Keep
the box and helper together in a vertical flex stack with an explicit gap. Typed
text and gray completion flow together on one baseline, synchronized with input
scrolling. Do not position completion with character-count offsets or different
text metrics. Preserve keyboard acceptance and chip removal behavior. Commit
drafts before chip-removal clicks so stale blur callbacks cannot restore removed
tags. When focus moves to Submit/Save or a modal dismissal action, leave the
draft in place; request builders and dirty-state checks include it, and
converting it into chips could move the button during the click.

Show duration is one required positive-integer seconds input (`min=1`, `step=1`,
maximum 2,147,483,647). Send seconds directly through the existing API contract.
A live gray helper breaks valid seconds down into hours, minutes, and seconds,
omitting any zero-valued unit and using `LabeledFormControl` helper styling
across Show forms, including Mixcloud import. Empty or invalid values omit the
breakdown. Do not reintroduce separate hours/minutes/seconds inputs.

## Design ideas and review boundaries

The reviewed work implemented common typography, spacing and controls; compact
tag helper spacing; desktop top alignment; phone stacking; and seconds-only Show
duration. These are defaults for future resource modals.

One suggested refinement remains unimplemented: clearer visual emphasis for a
message modal's primary action. Propose the concrete styling before implementing
it; keep it consistent with the bordered form actions and choose initial focus
according to the safest action for that message.

Tag editing opens from the Tags table in a prefilled `EditTagModal`. Title,
required hex color, Mixcloud key, and optional HTTP(S) URL are editable. The
shared `LabeledFormControl` supports trailing content for the live Tag chip
beside the color input; no visible preview label is shown. Invalid colors
replace the chip with guidance. Helper text and the review note have no trailing
periods. The shared shell's optional action helper explains that saving marks
the tag reviewed. There is no reviewed checkbox. Dirty comparison uses opening
values; failed saves retain edits, successful saves close and reload Tags.
Returning to DJs or Shows reloads their tag dictionary through their normal
loaders. The Tags toolbar’s “+ tag” action opens onboarding with the same
metadata fields, native color picker, and live chip. Title and color are
required; color starts at `#cccccc`. Optional blank metadata is omitted from
creation requests. New tags are reviewed; existing titles reuse their current
tag without changing its metadata. Success closes and refreshes Tags, clearing
the search so the tag can be found. Failed submissions retain values; dirty
dismissal requires confirmation. Merging and grid views remain outside this
workflow.

### Inline Tag review

The Tags table reviewed cell shows its saved boolean and a “Review” button.
Reviewed tags use a dashed border and transparent background, including on
hover; unreviewed tags keep the solid border and white background. Review
replaces the cell contents with “reviewed?” and matching square check and cross
buttons, both 28px high. The cell reserves the full prompt width in its resting
state so opening Review does not resize the column. The check immediately saves
`true`; the cross immediately saves `false`. Both use the keyed
`edit_type: "review"` request and preserve metadata. Escape from either action
dismisses the prompt without saving. Opening focuses the check; completion or
dismissal returns focus to Review. Saving disables both answers and prevents
duplicate requests. Failures retain the prompt with an actionable inline error;
either answer can be retried. Successful responses update only the row's
reviewed state, retaining search and sort. The existing full editor continues to
mark metadata saves reviewed.

## Verification and delivery

Deliver one narrowly scoped chunk with documentation and focused verification,
then pause for user review before starting another. Read
[`TYPESCRIPT.md`](TYPESCRIPT.md) for code conventions and
[`api-routes.md`](api-routes.md) before changing API behavior.

For layout, styling, or interaction changes, use `agent-browser` against the
authenticated local stack before handoff, as required by
[`AGENTS.md`](../AGENTS.md). Inspect affected create/edit views at desktop and
phone widths; 390px and 320px have been used for phone checks. Wait for
rendering and fonts to settle. Exercise changed controls, keyboard focus,
scrolling, and layered dialogs where relevant. Capture and inspect screenshots;
report any runtime blocker explicitly.

Run formatting, lint, TypeScript checks, and the smallest relevant tests. The
modal interaction suite is `integration-tests/modal-cancellation.spec.ts`; it
covers dismissal, crop layering, tag loading and alignment, and seconds input
validation. Use mocked mutations or the
[`isolated database runbook`](DATABASE_E2E_TESTING.md) to avoid writing test
records to the normal archive dataset.

### Resource view width and alignment

Resource titles, toolbars, tables, and grids share the same horizontal bounds.
Search starts at the title and data's left edge; the action group ends at their
right edge. Desktop views start 40px beyond the floating sidebar's right edge
and end 40px from the viewport's right edge. Below the existing sidebar
breakpoint, all resource content uses 20px viewport gutters. Tables scroll
horizontally within these bounds, keeping Edit sticky; grids retain 16rem
preferred columns that can shrink on narrow screens. At 450px and below, search
fills its own row and actions align right below it. Sticky toolbar backgrounds
cover the resource body width. When stuck, the toolbar adds 16px internal
horizontal padding, reduced to 12px at 450px and below, around search and
actions.

Verify alignment, horizontal scrolling, grid columns, and sticky controls with
`integration-tests/resource-layout.spec.ts` and agent-browser at desktop,
tablet, and phone widths. The layout suite mocks resource reads and writes no
archive records.

### Tag deletion confirmation

Tags offer a square Delete button with red text and border beside Edit in the
sticky Actions column. Shows and DJs retain their existing actions. Deleting
opens a message dialog with the tag title, permanent-deletion explanation, and
separate affected Shows/DJs lists with counts, titles, and IDs. DJs identify
direct, inherited, or combined assignments. Long lists scroll independently;
empty lists are explicit. Loading impact disables Delete; failures offer Retry.

Cancel receives initial focus. Escape, Cancel, and backdrop dismissal restore
focus to the opener while idle. Pending deletion disables both actions and
blocks dismissal and duplicate submission. Failures retain the dialog with
server/HTTP detail. Success removes the row without resetting search or sort and
focuses search. The underlying resource view is inert while the dialog is open.
The message shell supports optional content, destructive action styling, and
opt-in opener focus restoration; existing callers retain their defaults.

### Mixcloud table

The sidebar entry follows Tags and opens `#mixcloud`, with lowercase “mixcloud”
and “import” on two lines. The page heading is “Mixcloud Import.” This read-only
view uses the shared resource layout, sticky search toolbar, sortable table,
loading/retry, empty, and no-results states. Its twenty-two columns are ID, Key,
url, name, created_time, derived_title, derived_date, decoded_djs,
parser_version, parser_key, date_source, image_small, image_large,
mixcloud_tag_json, duration, show_id, imported_at, data_changed, show name, djs,
dj names, and tags. URL and image URL fields display source text; image URLs are
clickable and open their image in a new tab. Duration is the stored Mixcloud
duration, including for pending rows. `mixcloud_tag_json` displays source
key/name/URL objects and supports search and sorting. Source keys are separate
from the archive tag IDs in `tags`. The read-only `data_changed` column displays
`true` or `false`, participates in search, and sorts false before true in
ascending order. Readiness controls open pending import queues for ready and
review categories. Search covers all displayed parser fields, including raw ISO
and formatted UTC derived dates. Parser dates sort chronologically and versions
sort numerically; missing values sort first ascending. Extracted DJ names
display comma-separated, with muted “None” for missing or empty arrays; version
zero displays as `0`. These suggestions are read-only and separate from linked
archive Show/DJ values. Refresh populates parser suggestions and clears stale
results on parse failure. Search covers all displayed fields; sorting defaults
to ID ascending. Timestamps use UTC, durations use HH:MM:SS, arrays display
comma-separated values, and missing values show muted “None.” Unimported records
remain visible. There are no Edit import actions or view toggles. Readiness
buttons open the pending import queue. An enabled “Refresh Mixcloud” button uses
the shared toolbar action position and styling beside search. It calls the
refresh route, disables itself with “Refreshing Mixcloud…” while refreshing and
reloading the table, and preserves search and sort. Inline status/error messages
appear below the toolbar. Refresh failures retain existing rows and allow
another button click to retry; errors include human-readable server feedback
rather than raw internal errors. A reload failure after a successful refresh is
identified separately. Shared toolbar creation controls and table Edit controls
are optional; existing resources continue supplying them.

The user verified and approved the parser-column UI after chunk 3. The automated
browser verification attempt was interrupted before completion.

### Mixcloud readiness controls

The Mixcloud toolbar places “ready for import” and “needs review” immediately
before “Refresh Mixcloud”. Nonzero counts appear in square badges: green for
“ready for import” and red for “needs review”, with a 1px black outline and
white text, aligned to the right. Zero counts show no badge. Hovering “needs
review” shows a native tooltip explaining that these shows could not be
automatically parsed or their DJs have not been onboarded yet. “ready for
import” has a native tooltip explaining that parsing and DJ onboarding are
complete and the shows are ready to review and import. “Refresh Mixcloud” has a
native tooltip explaining that it fetches the latest shows and updates their
import status. The shared toolbar accepts an optional `createTitle` for this
action tooltip. Counts load from `/api/admin/mixcloud-import/status` on page
load and after refresh or import. Loading hides badges and disables the
controls; status failures show retry feedback. Each category button opens Import
Show with all pending category rows in ascending ID order, independent of table
search and sort. Imported rows are excluded. A category with no pending rows
shows a brief message dialog. The buttons use dialog-launch semantics rather
than toggles.

Remaining count includes current and skipped pending rows. Save decreases it;
Next Show advances without writes or count changes. Skipped rows return when
reopening. Cancel closes the import session without importing or advancing.
Cancel and navigation guard dirty edits using the shared confirmation.
Successful 201 and already-imported 200 responses advance, and the last session
item closes automatically. Closing restores focus to the launching category
button after the background becomes interactive. The resource view is inert
while a dialog is open, and Refresh Mixcloud is disabled.

After Save, local tracking and counts update before list/status reloads. Reload
failures appear separately with Reload import list, preserving the committed
import and advancing the queue. Obsolete overlapping reload responses are
ignored. Table search and sort are retained throughout.

`integration-tests/mixcloud-import-queue.spec.ts` mocks API reads and mutations
and covers both categories, order, exclusions, count semantics, skipped-row
reopening, empty/final closure, dirty dismissal/navigation, focus,
pending/failure and retry behavior, post-commit reload failure, overlapping
reloads, and phone action reachability. The user is performing visual acceptance
for this chunk.

### Show image URL variants

Show create/edit modals require separate “small image URL” and “large image URL”
HTTP(S) fields, using the shared labeled controls and responsive form layout.
Editing prefills both stored URLs; each participates in draft comparison and
failed-save retention. Empty or invalid image URLs prevent submission. The Shows
table replaces the legacy image column with clickable `image_small` and
`image_large` columns, each searchable and independently sortable. Grid cards
continue using the legacy image value, which saves synchronize with the large
URL.

### Import success toast

Mixcloud imports display a reusable `ToastModal` after a successful save. It
shows “Successfully added show.”, the saved show title and comma-separated DJ
names, and saved colored tag chips at the top left. A vertical flex column uses
an 8px gap between the heading, show details, and tags. The toast sits outside
the queue so it survives the final item closing. Each success resets its timer.
The white box uses black text and a 1px black border, with message and right
close button in a flex row. It begins fading after four seconds and dismisses
250ms later. Hovering pauses the timer and keeps the toast visible; leaving
resumes the remaining time. Reduced motion removes the transition. It announces
status without moving focus, and its close button dismisses immediately. Failed
saves show no success toast.

The source section omits id, key, and show_id. HTTP(S) source URLs are clickable
and open in a new tab; missing URLs keep the existing None feedback.

The Mixcloud database table uses one `mixcloud_tag_json` column, displaying the
original key/name/URL JSON from the `mixcloud_tags` API field. Names preserve
source case. The column participates in shared search and sorting; absent source
tag data displays None, and an empty array displays `[]`.

Mixcloud import navigation includes a mirrored Previous Show arrow to the left
of the panel, matching Next Show. On smaller screens the arrows sit together
below the scrolling panel. Previous is disabled when no earlier pending session
item exists and uses a gray arrow, border, and background while disabled;
imported items are excluded in both directions. Back navigation uses the same
dirty-change confirmation and submission lock as Next.

The import source panel also shows `mixcloud_tag_json`; the duplicate keys
column is removed from the database table. Selected tags in the shared input
carry `title` and optional `mixcloud_key` / `mixcloud_url`. Chip removal removes
the full object, while draft commits create title-only objects and preserve
metadata on existing selections. DJ and Show requests convert selections to
titles; import Save passes selected new source objects to create-tag.

### DJ relationship picker

Only the Mixcloud import form opts into empty DJ feedback. An empty DJ selection
makes the DJ label, search text, and selector border red, with `aria-invalid` on
the search input. Selecting a DJ restores normal styling; loading does not show
the empty-selection warning.

The shared DJ picker places selected names in square chips inside the search
field, with a separate right-hand x button for each removal. Display names omit
record IDs. Focusing or typing in the field opens a scrolling dropdown of DJ
options. There is no dropdown arrow. The search has a 12px gap from the chips,
gray inline completion, and the same Tab-completion helper as tags. Clicking
anywhere on an option row selects it while keeping search focused; selected DJs
are excluded from suggestions. Arrow keys navigate, Enter selects, and Tab
accepts a prefix completion. Tags and DJs share matching, completion, and option
pointer handling through `shared/modal/autocomplete`. Leaving the control closes
it, and Escape from search closes the dropdown before dismissing the modal. The
Mixcloud source name value is bold for easier comparison with the editable
title.

DJ chips preserve selection order, including after options reload or a DJ is
removed and selected again. Tags and DJs share `useChipBackspace`: with an empty
search, the first Backspace outlines the last selected chip; the second removes
it. Typing, choosing an option, or removing a chip clears the armed state.

The import form uses the shared content-sized modal panel, matching other forms.
Its height follows content up to the viewport limit, with longer forms scrolling
inside the panel. Ordinary Show create/edit forms keep empty DJ fields neutral.

### Tags grid and inline color editing

Tags uses the same ResourceGrid/card renderer and saved table/grid preference as
Shows and DJs, defaulting to table. Grid columns have a 32rem minimum,
constrained to the available width; existing resource grid defaults remain
16rem. Large chips use 2.625rem text (three times the ordinary chip text) and
three times the ordinary chip padding, following the app’s responsive root font
size. Long names wrap, and controls stack below chips on phones.

Each tile displays a large tag, native color swatch, and Edit action opening the
existing metadata modal. Swatch and actions stay visually grouped with a
0.625rem gap and no reserved empty action width. Changing the swatch previews
the color locally and replaces Edit with cancel/save icons only when the color
differs from the saved value ignoring hex case. Cancel restores the saved color
without a request. Save sends only ID and color using modify-tag partial_edit,
marks reviewed, and updates the returned tag in place. Controls are disabled
during save; failures retain the preview and show an inline error for retry.
Drafts are discarded when switching views or filtering the card out. Table-only
review and delete actions remain available through the table view.
