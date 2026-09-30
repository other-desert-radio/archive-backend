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
DJ and Show tables/grids and the Tags table scroll underneath. Its gray
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
Do not reintroduce separate hours/minutes/seconds inputs.

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
dismissal requires confirmation. Merging, deletion, and grid views remain
outside this workflow.

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
