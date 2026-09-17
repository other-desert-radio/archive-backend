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
