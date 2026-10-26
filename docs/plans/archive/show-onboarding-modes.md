# Show onboarding modes

Status: inactive at the user's request. Switching behavior is expected to
change; automated tests specific to show-mode switching are deferred.

## Decisions

- Work in chunks: structure → scaffolding → implementation.
- Reuse SegmentedPicker for grid/table and Show onboarding.
- Show modes are new_show (default on reopening) and existing_show.
- Titles are New Show and Onboard Show. Switching preserves fields and is not
  dirty.
- Use native browser tooltips and repeat the selected description in a small
  paragraph above all fields, using the same strings for both.
- Selected show segment: bold white text, black background and border.
  Unselected: gray text and border on white. Equal widths and 1px borders.
  Grid/table retains its default appearance.
- Disabled modal submit buttons retain white backgrounds with gray text/borders.
- Both modes retain archive-save behavior; Mixcloud upload wiring is deferred.

## Progress

- [x] Shared picker structure, scaffolding, implementation, and user review.
- [x] Modal integration structure and scaffolding approved.
- [x] Implement mode state, field selection, titles, native tooltips, and
      pending lock.
- [x] Apply user-requested segment and disabled-submit styles.
- [x] Add selected-mode paragraph and focused browser assertions.
- [x] Update authoritative UI guide.
- [ ] User review of the final modal and helper paragraph.
- [x] Move this plan to the archive at the user's request.

## Verification

- Latest typecheck, admin build, targeted Biome checks, docs checks, and diff
  checks pass. Picker unit test passes; repository lint passed before the helper
  paragraph addition.
- Before removal, all five mode browser tests passed, covering
  desktop/390px/320px, helper text, selection, native tooltip attributes,
  titles, preserved fields, reset, keyboard selection, equal sizing, unchanged
  payloads, and submission locking.
- Inspected authenticated agent-browser screenshots at desktop, 390px, and 320px
  against a disposable stack. On 320px the close control wraps below the picker;
  form content remains inside the viewport and scrollable.
- Earlier regression runs passed 25 edit-show, seven resource-layout, and eight
  modal-cancellation tests before the final styling/helper changes. These wider
  suites were not repeated after the helper paragraph addition.
- Disposable verification stack: archive-show-modes on port 3001. Regular
  archive data was not used for test writes.

## Next action

Inactive. Do not add tests for modal switching until its behavior is settled.
The switching-specific browser suite was removed; shared picker and existing
modal tests remain. Final modal review is not recorded as complete.
