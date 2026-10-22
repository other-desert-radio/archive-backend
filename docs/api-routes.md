# API Route Conventions

Read this document before adding or changing an API route.

## Authentication

`adminRoutes` in `src/admin/admin.ts` protects `/api/admin/*` with a Better Auth
cookie session. Admins and editors can manage archive resources; only admins can
list, create, delete, reset passwords, or change roles for accounts. The
`/admin/*` shell and `/health` are public. Basic Auth is removed.

Browser auth routes allow sign-in, session lookup, and sign-out under
`/api/auth/*`. Public signup and direct Admin plugin/alternate password mutation
routes are blocked. Account mutations require a trusted Origin. Never expose
password hashes, tokens, or plaintext passwords in API responses or logs.

- `GET /api/admin/users` returns
  `{id,email,role,mustChangePassword,banned,banReason?,banExpires?,mixcloudName?,mixcloudKey?}[]`
  (ban expiry is an ISO timestamp; absent optional values are omitted).
- `POST /api/admin/create-user` accepts `{email,password,role}`.
- `POST /api/admin/modify-user-role` accepts `{id,role}`.
- `POST /api/admin/reset-user-password` accepts `{id,password}`.
- `POST /api/admin/remove-user` accepts `{id}` and returns `{id}`.
- `POST /api/account/change-password` accepts `{currentPassword,newPassword}`.

Create, role change, and reset return the user summary. Admin-supplied passwords
require replacement before archive access; protected requests return 403 with
`code: "PASSWORD_CHANGE_REQUIRED"`. Passwords must contain 8–128 characters;
spaces are preserved. Reset and role changes revoke existing sessions.
Management mutations serialize with a database lock; self-deletion,
self-demotion, and removing the last admin are rejected. Errors use
`{error,code?}`.

Document resource route plugins as authenticated and register them beneath the
shared boundary rather than duplicating permission checks.

## Route layout

### Mixcloud connection routes

Admins and editors use their own archive session for these routes. No route
accepts a user or session ID from the browser. Responses use
`Cache-Control: no-store`.

- `GET /api/admin/mixcloud/status` returns `{configured:false,connected:false}`
  when disabled, `{configured:true,connected:false}` when disconnected, or
  `{configured:true,connected:true,account:{key,displayName}}` when connected.
  Status reads only account identity, never the stored access token.
- `POST /api/admin/mixcloud/connect` creates a session-bound authorization
  attempt and returns `{authorizationUrl}` for the browser to navigate to
  Mixcloud. Normal browser origin checks apply. Disabled integrations return 503
  with `{error:"Mixcloud is not configured"}`. Storage failures return a generic
  500; raw database errors and generated state are excluded from route logs.

- `GET /api/admin/mixcloud/callback` requires the initiating archive session and
  a single nonempty `state`. The store validates session ownership, attempt
  expiry and single use before invoking code exchange and identity lookup, then
  saves the encrypted connection. Provider denial or failure consumes the
  attempt while preserving an existing connection. Success/failure uses a 303
  redirect to `/admin/?mixcloud=OUTCOME#upload`, where OUTCOME is `connected`,
  `denied`, `invalid_attempt`, `unavailable`, or `failed`. These markers are
  informational; the UI must fetch status as the source of truth. No provider
  text, credentials, or caller-supplied redirect destination is forwarded.
  Missing/invalid archive sessions retain the shared boundary's 401/403
  response.
- `POST /api/admin/mixcloud/disconnect` returns `{disconnected:true}` after
  deleting the acting user's connection and pending attempts. It is idempotent,
  requires a trusted browser origin, and serializes with callback completion.
  Disabled integrations return 503. This does not log out of Mixcloud or revoke
  authorization at the provider.

Mixcloud responses also use `Referrer-Policy: no-referrer`. Application, admin,
and origin-rejection request logs record paths without query strings to exclude
OAuth codes, state, and tokens. Raw provider and storage errors are not logged
by the Mixcloud handlers. The upload page consumes these routes and reloads
status after authorization; the callback marker alone never establishes a
connection.
