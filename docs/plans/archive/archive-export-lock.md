# Archive export lock and image hashing

- Preserve unrelated staged edits and all existing export paths.
- [x] Shared lock through standalone writes and publisher Git staging/commit.
- [x] Incremental raw-image hashing with explicit framing.
- [x] Deterministic overlap and failure-release tests, documentation,
      verification.
- User review pending.

## Result

- Shared session lock spans standalone allocation and writes, and the
  publisher's validation, synchronization, allocation, writes, staging, commit,
  push, and acknowledgement. Use the callback's connection handle for nested
  work.
- DJ hashing streams raw image bytes framed by identity, variant, and byte
  length.
- Deterministic tests pause a standalone writer and pause publication before
  staging; competing exports wait and committed/output versions match snapshots.
- Failure-release test uses a separately pinned observer session; buffer hashing
  test rejects any attempt to call Buffer.toJSON.
- Full suite: 705 passed, 22 unrelated database tests skipped, 0 failed. Refined
  observer test rerun: all seven allocator tests passed. Type checking,
  repository lint, docs checks, and diff whitespace checks passed.
- Existing DJ allocations receive one version increment when the hash format
  changes. No production memory benchmark, frontend edits, or regular-database
  migration performed. Multi-file output remains non-atomic for readers.
- Implementation complete; user review remains pending.
