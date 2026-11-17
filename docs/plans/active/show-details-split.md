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
- [ ] User review of chunk 1 structure.
- [ ] Chunk 1 scaffolding and review: necessary document contracts only.
- [ ] Chunk 1 implementation and review: pure document split and focused tests.
- [ ] Chunk 2: version constraint migration, hashing/allocation, and file
      output.
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

## Verification

Focused export/version/publication tests, typecheck, lint, docs checks, and
migration/export checks against a disposable database. Test unknown timestamps,
zero offsets, chapters, sanitization, ordering, empty details, independent
versions, retry consistency, deletions, legacy baseline reads, and detail-only
preview changes.

## Next action

Await structure review, then add the minimum document contracts for chunk 1. No
frontend changes or publication are authorized by this implementation plan.
