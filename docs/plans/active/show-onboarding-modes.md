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
- [ ] User review of shared picker scaffolding.
- [ ] Implement picker and grid/table reuse; verify and review.
- [ ] Propose modal integration structure and review.
- [ ] Scaffold modal integration and review.
- [ ] Implement modes, tooltips, and shared field selection; verify and review.
- [ ] Update authoritative UI documentation and archive this plan on completion.

## Current unit

New component files live under
src/admin-ui/components/shared/resource-views/segmented-picker/:
segmented-picker.tsx owns controlled selection and optional tooltips;
segmented-picker.module.css owns presentation; index.ts exposes the component.
The generic string-valued contract exposes label, value, readonly options,
onChange, and optional disabled. Options contain value, label, and optional
tooltip. The component is exported through its own and the resource-views
barrels. Its body explicitly throws Not implemented: SegmentedPicker and is not
connected to live callers.

After scaffolding approval, ResourceToolbar will pass its existing view mode and
callback into the picker. The resource-views barrel will expose the picker.
Existing grid/table styling moves into the picker during implementation.

## Verification and next action

Next: scaffolding review before implementing the picker and migrating the
toolbar. Intended flow: ResourceToolbar viewMode/options → SegmentedPicker →
onChange → existing onViewModeChange. There is no picker-owned persistence or
I/O; tooltip rendering and interaction are unimplemented.

Implementation verification includes focused interaction coverage, formatting,
lint, typecheck, admin build, documentation checks, and authenticated visual
acceptance at desktop, 390px, and 320px. Preserve edit-show behavior and check
grid/table selection, tooltips, focus, mode reset, retained values, and
submission.
