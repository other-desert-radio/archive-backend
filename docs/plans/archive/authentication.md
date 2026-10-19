# Authentication implementation

## Decisions

- One-shot implementation with backend, UI, and verification subagents.
- Roles admin/editor. Editors retain all archive operations; only admins manage
  accounts and roles.
- Admin sets initial/reset passwords; require replacement before archive access.
  Everyone can change own password with current password.
- Passwords 15–128 characters, spaces allowed, never trimmed; Better Auth owns
  hashing and verification.
- Public SPA/login, session-only APIs; remove Basic Auth. Existing users remain
  admins and do not require replacement.
- Seven-day cookie sessions; secure HTTP-only same-site cookies over HTTPS,
  origin checks and database-backed rate limits.
- Admin plugin used server-side only. Block direct plugin and alternate mutation
  endpoints. Allow browser sign-in, session and sign-out.
- Serialize management mutations with DB-backed lock and recheck
  actor/last-admin safety. Reject self-deletion/self-demotion. Revoke sessions
  after reset/role change; cascade deletion.
- Initial admin CLI securely prompts, only provisions when no admin exists.
- Migration `0028_complete_account_authentication` adds plugin fields,
  rate-limit storage, mustChangePassword, constrained required role/default
  editor, normalized case-insensitive unique emails (fail on collisions).
- Build login in current modal style; later reference will refine it.

## Shared contracts

- User summary: `{id,email,role,mustChangePassword}`; role admin/editor.
- GET /api/admin/users returns summary array.
- POST /api/admin/create-user `{email,password,role}`; modify-user-role
  `{id,role}`; reset-user-password `{id,password}` return summary.
- POST /api/admin/remove-user `{id}` returns `{id}`.
- POST /api/account/change-password `{currentPassword,newPassword}`.
- Existing /api/auth/sign-in/email, /get-session, /sign-out. Session includes
  user role/mustChangePassword.
- Errors `{error,code?}`; forced-change rejection 403
  `PASSWORD_CHANGE_REQUIRED`.

## Progress

- [x] Read-only discovery and product decisions.
- [x] Backend implementation and focused tests (auth_backend).
- [x] UI implementation (auth_ui); build, focused tests, and typecheck passed
      before backend integration.
- [x] Integration fixtures, browser/security tests, documentation
      (verification).
- [x] Primary integration, checks, browser screenshot acceptance.
- [x] Final report prepared; plan archived.

## Verification outcome

Unit suite: 385 passed, 11 skipped. All 152 browser tests passed across the
integrated run and final targeted rerun. The integrated run passed all six auth
tests and 145 archive tests; the remaining Show API test passed after moving the
base URL default into the shared fixture (both Show API tests passed on rerun).
Typecheck, lint, build, documentation and whitespace checks pass. Inspected
login, account creation and required-change screens at desktop/390/320.
Corrected test fixture key reuse, shared archive session setup and
case-sensitive SHOWS heading assertion, stale resource expectations, and column
selectors. Regular archive database remains untouched. Deployment still requires
a secure server secret, explicit migration 0028 application, and initial
administrator provisioning using scripts/create-admin. User design review
remains pending.
