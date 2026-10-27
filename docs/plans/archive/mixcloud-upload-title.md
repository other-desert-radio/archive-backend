# Mixcloud upload title

One-shot approved. Frontend generation; manual overrides with reset; DJs joined
with +. No database writes.

- [x] Implement panel, title generation, and upload contract
- [x] Verify focused tests, types, build, docs, browser
- [x] Archived at the user’s request

Verified: 40 focused Bun tests, 13 browser tests at 1280/390/320px, typecheck,
admin build, Biome, docs check. Screenshots inspected. Live provider upload not
performed.

Final UI refinements: Upload Show heading; MIXCLOUD panel; centered account
identity without “via Mixcloud”; full-width title input with only an underline
and an accessible, visually hidden label. Title stays hidden on an untouched
form, generates from available fields while typing, and preserves manual edits
until reset. DJs sit below the show title. All upload form fields are required
except description and tags. Initial sign-in-only spacing was reduced.

Follow-up verification: 14 modal browser tests passed, including required-field
coverage. Final visibility/full-width checks passed at 1280/390/320px. Latest
spacing adjustment passed build, formatting, and visual inspection. Live upload
remains untested.
