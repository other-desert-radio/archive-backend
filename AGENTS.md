# Agent instructions

Before changing this repository, read the relevant guidance in [`docs/`](docs/).
Before adding or changing an API route, also read
[`docs/api-routes.md`](docs/api-routes.md) and follow its authentication,
route-layout, shared-type, and validation conventions. Keep the implementation
small and update the docs in the same chunk as any behavior or workflow change.

Build all features incrementally. Implement one small, narrowly scoped feature
at a time, include focused tests and documentation, then stop and ask the user
for review or input before beginning the next feature. Do not bundle unrelated
backend, frontend, authentication, database, or deployment work into a single
chunk.

## Visual admin UI checks

For any admin UI layout, styling, or interaction work, use `agent-browser`
before handoff. This is a required acceptance check, not an optional diagnostic:
start the local stack, open the affected authenticated view, wait for it to
settle, and inspect its snapshot or screenshot. Exercise the affected control
when the change is interactive.

```sh
agent-browser --session admin-ui-verify open http://admin:admin@localhost:3000/admin/#djs
agent-browser --session admin-ui-verify wait 500
agent-browser --session admin-ui-verify snapshot -i
agent-browser --session admin-ui-verify screenshot /tmp/admin-djs.png
```

The browser session uses a socket outside the workspace sandbox, so request
approved elevated permission when necessary. The documented credentials are for
local development only; never use them outside that environment. Check `#shows`
and `#tags` as applicable. Report what was verified, or clearly state the local
runtime blocker that prevented verification.
