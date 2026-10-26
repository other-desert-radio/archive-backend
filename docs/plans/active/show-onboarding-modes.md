# Show onboarding modes

## Decisions

- Work in small chunks using structure → scaffolding → implementation.
- First unit: extract the grid/table buttons into a shared segmented picker.
- Second unit: add the picker to the Onboard Show header with new/existing
  modes.
- Default to new_show on opening; switching preserves fields and is not dirty.
- Both modes initially share fields, validation, and current archive submission.
- Mixcloud wiring is deferred; the new-show tooltip describes future behavior.

## Progress

- [x] Inspect existing toolbar, show form, modal header, and project guidance.
- [x] Create responsibility-only files for the shared picker.
- [x] User review of the first unit's file structure and request for
      scaffolding.
- [x] Scaffold the shared picker contract.
- [x] User review of shared picker scaffolding.
- [x] Implement picker and grid/table reuse; user approved proceeding.
- [ ] Complete browser acceptance for grid/table migration.
- [x] Propose modal integration structure.
- [x] User review of modal integration structure and request for scaffolding.
- [x] Scaffold controlled mode and header renderer contracts.
- [ ] User review of modal integration scaffolding.
- [ ] Implement modes, tooltips, and shared field selection; verify and review.
- [ ] Update authoritative UI documentation and archive this plan on completion.

## Previous unit verification

The shared picker is implemented and ResourceToolbar uses it for grid/table. In
the previous checkout, 17 focused tests, admin build, lint, documentation, and
diff checks passed. Typecheck was blocked by missing src/res/mixcloud.json.
Browser acceptance reached sign-in without an authenticated session; it remains
outstanding. Checks have not been rerun in the new checkout.

## Current unit: proposed modal integration structure

No new component directories are needed. Modify the existing onboard-show-modal
component to own opening-scoped mode state. Modify show-form-modal to receive
the optional controlled onboarding mode, render SegmentedPicker in the existing
headerContent slot, and select the shared fields through a switch. Editing omits
the mode and keeps its existing controls. Extend the shared onboarding-modal
headerContent contract to accept a render callback exposing submission state so
the picker can be disabled during submission; existing ReactNode callers remain
supported.

Data flow: onboarding wrapper mode → ShowFormModal → SegmentedPicker → wrapper
mode setter. Form values stay owned by ShowFormModal and survive mode changes.
The shared shell continues to own submission state. No runtime changes belong to
this structure checkpoint.

## Verification and next action

Scaffolded ShowOnboardingMode (new_show | existing_show) and its controlled
value/onChange contract as an optional ShowFormModal prop. Existing callers omit
it. The shell accepts static ReactNode content or a renderer receiving
isSubmitting. Static content still renders normally; renderHeaderContent
explicitly throws Not implemented until implementation. No live caller supplies
a renderer yet. Mode state, picker wiring, and field switching are deferred.

Next: scaffolding review before implementing the tightly coupled modal unit.

Scaffolding verification in this checkout: targeted Biome checks, TypeScript,
admin build, documentation links, and diff checks all passed. No executable
picker behavior was added in this checkpoint; browser checks remain deferred.

Implementation verification includes focused interaction coverage, formatting,
lint, typecheck, admin build, documentation checks, and authenticated visual
acceptance at desktop, 390px, and 320px. Preserve edit-show behavior and check
grid/table selection, tooltips, focus, mode reset, retained values, and
submission.
