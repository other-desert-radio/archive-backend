# Show details split

## Decisions

- Work in chunks, each with structure, scaffolding, and implementation review.
- Move descriptions and tracklists out of the show index and embedded DJ shows.
- Export independently versioned show_details.json with the existing envelope.
- One detail record per show: id, optional sanitized description, optional
  nonempty tracklist. Preserve order and zero offsets; omit unknown start_time
  values.
- Add show_details to the version manifest and database dataset constraint.
- Existing GitHub Pages gzip negotiation and identity fallback were verified. No
  gzip sidecars or browser decompression library are needed.
- Backend work only; frontend consumption is delivered as a handoff document.
- Coordinate frontend compatibility before publishing the split.

## Progress

- [x] Inspect current exporter, version allocation, publication, and frontend
      consumers.
- [x] Present overall plan; user selected chunked work.
- [x] Chunk 1 structure proposal prepared.
- [x] User review of chunk 1 structure.
- [x] Chunk 1 scaffolding: necessary document contracts only.
- [x] User review of chunk 1 scaffolding.
- [x] Chunk 1 implementation: pure document split and focused tests.
- [x] User review of chunk 1 implementation.
- [x] Chunk 2 structure and scaffolding approved.
- [x] Chunk 2 implementation: version migration, hashing/allocation, and file
      output.
- [x] User review of chunk 2 implementation.
- [x] Chunk 3 structure proposal prepared.
- [x] User authorized completion of chunks 3 and 4 ("do them").
- [x] Chunk 3 implementation and verification.
- [x] Chunk 4: authoritative docs, frontend handoff, and size measurements.
- [ ] User review of the final implementation.

## Chunk 1 structure

Use existing src/db/export-archive.ts for the detail contract and pure mapping;
use tests/db/export-archive.test.ts for behavior checks. No new code files.
Search typed ArchiveDocuments fixtures before adding the required details
member; update affected fixtures in their owning tests during implementation.
Keep current writer and publication integration for subsequent chunks.
Intermediate chunks are not deployable until versioning and publication
integration are complete.

## Chunk 2 structure

- New src/db/migrations/0045_add_show_details_dataset.ts: expand the dataset
  constraint; rollback removes only the details version row and restores it.
- Existing src/db/archive-versions.ts and src/db/types.ts: dataset contract,
  independent detail hashing, and allocation.
- Existing src/db/export-archive.ts: write show_details.json before the
  manifest.
- Existing tests/db/archive-versions.test.ts and
  tests/db/export-archive.test.ts: migration rollback/reapply, independent
  versions, retries, and writer behavior.
- Existing tests/publication/runner.test.ts: apply the new migration in the
  disposable database setup so allocation remains valid.
- Update authoritative export/database docs for the fourth dataset.

No new service, compression code, or production database migration execution.
Scaffolding adds only the new migration file with a responsibility comment;
version contracts and dependent behavior change together during implementation.

## Chunk 3 structure

No new files or public contracts; no separate scaffolding is needed.

- Existing publication/git/commits.ts, checkout.ts, local-preview.ts, and
  preview.ts: include details in staging, commit verification, destination
  validation, fingerprints, and commit reads.
- Existing publication/preview-diff.ts: join details to shows by ID for preview
  signatures and retain tracklist order. Accept legacy embedded details when the
  separate file is absent. Validate duplicate and orphan detail IDs.
- Existing publication/store.ts: require the fourth dataset and compare the
  versioned details file when deciding whether local output needs publication.
- Existing publication tests: cover detail-only changes, reordered tracks,
  legacy baselines, unsafe destinations, local fingerprints, staging, and
  recovery.

Keep the UI's existing added/changed/removed show groups; no UI layout changes.
Legacy job snapshots may omit the details version and must remain recoverable.

## Verification

Focused export/version/publication tests, typecheck, lint, docs checks, and
migration/export checks against a disposable database. Test unknown timestamps,
zero offsets, chapters, sanitization, ordering, empty details, independent
versions, retry consistency, deletions, legacy baseline reads, and detail-only
preview changes.

## Completion and rollout

Backend implementation is complete and this plan is archived. The separate
frontend handoff document was subsequently removed. The current export contract
is [Static Archive Export](../../ARCHIVE_EXPORT.md). Frontend code,
regular-database migration, and live publication were not performed. Coordinate
frontend compatibility before publishing the split.

Verification: typecheck, lint, docs checks, and full suite passed (788 passed,
75 opt-in skips). The full suite required execution outside the sandbox for
local HTTP listeners. Separate disposable-database publication/export/version
checks passed (145 passed, five unrelated notification/store skips), including
real Git staging/recovery, legacy snapshots, migration rollback/reapply,
detail-only updates, and stale/missing file repair. A final focused run after
narrowing merged detail fields passed all 30 tests. The test container is
stopped.

Measured local snapshot: 310 shows, 3,216 track entries. The show index is
227,981 raw / 26,195 gzip bytes; details are 380,787 raw / 87,895 gzip bytes.
Device timing and frontend acceptance remain for the separate consumer task.
