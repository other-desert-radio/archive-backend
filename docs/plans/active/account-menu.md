# Account navigation dialog

- Mode: chunked, requested by user.
- Completed: inspected management shell, shared MessageModal, and UI
  conventions.
- Completed: user approved structure and requested scaffolding.
- Current checkpoint: AccountDialog contract and dormant shell call site
  scaffolded; awaiting scaffolding approval before implementation.
- Proposed unit: move account controls from sidebar into a header-triggered
  dialog.
- Reuse MessageModal and ChangePasswordModal; keep existing sign-out handler.
- Files: management-shell.tsx, management-shell.module.css, ADMIN_UI_DESIGN.md.
- Next: implement AccountDialog, header trigger, focus transitions, and styling
  after review. AccountDialog currently throws explicitly if mounted; no live
  control opens it. Existing sidebar controls remain functional.
- Verification after implementation: formatting/lint, typecheck, admin build,
  authenticated agent-browser desktop and phone checks including keyboard focus,
  dismissal, password transition, and sign-out error/pending behavior.
- User review remains pending.
