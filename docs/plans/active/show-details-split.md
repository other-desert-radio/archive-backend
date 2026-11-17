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
- [ ] User review of chunk 2 implementation.
- [ ] Chunk 3: publication staging, previews, recovery, legacy baselines.
- [ ] Chunk 4: authoritative docs, frontend handoff, and size measurements.

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

## Verification

Focused export/version/publication tests, typecheck, lint, docs checks, and
migration/export checks against a disposable database. Test unknown timestamps,
zero offsets, chapters, sanitization, ordering, empty details, independent
versions, retry consistency, deletions, legacy baseline reads, and detail-only
preview changes.

## Next action

Await chunk 2 implementation review, then present chunk 3 structure. Chunk 2
checks: 20 tests passed with no skips against disposable PostgreSQL, including
rollback/reapply, independent detail revisions, unchanged retries, manifest
consistency, and export locking. Typecheck, lint, and docs checks passed. The
test container is stopped; the regular archive database was not migrated.
Publication staging, preview, and recovery integration remain pending, so this
intermediate state must not be published. No frontend changes are included.
