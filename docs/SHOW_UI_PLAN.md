
  # Reusable admin tables and Show onboarding

  ## Summary and confirmed decisions

  Deliver this work in three review chunks, stopping after each for user review:

  1. Extract reusable table, toolbar, and onboarding components; migrate DJs onto them.
  2. Build the Shows table using those shared components.
  3. Build complete Show onboarding, including the existing creation endpoint.

  The current DJ page is the visual reference. Both resources must use the same table markup, toolbar layout, modal shell, field layout, submission behavior, and feedback styling.
  Resource-specific columns, fields, validation, and API serialization remain separate.

  Confirmed Show onboarding requirements:

  - Manually enter metadata; no audio upload or Mixcloud publishing.
  - Require title, broadcast date, positive duration, show URL, and at least one existing DJ.
  - Artwork is an optional image URL, not a file upload.
  - Tags are optional and follow the current DJ behavior: comma-separated input, validation on blur, and creation of missing tags on successful submission.
  - Broadcast date has day-level granularity only. Accept YYYY-MM-DD, store midnight UTC in the existing timestamp column, and display YYYY-MM-DD.
  - Duration is entered as hours/minutes/seconds and stored as whole seconds.
  - Show tables display relationship IDs; search also matches related DJ and tag names.
  - No database migration is needed.

  Out of scope: Tags-page migration, richer tag chips/autocomplete, grid view, editing/deleting records, nested DJ creation, archive publication, authentication, and deployment changes.

  ## Handoff and review workflow

  - [ ] Save this plan as docs/SHOWS_IMPLEMENTATION_PLAN.md when implementation begins.
  - [ ] Maintain its checkboxes throughout implementation. Distinguish “implemented,” “verified,” and “reviewed”; never mark user review complete automatically.
  - [ ] Read current repository guidance before each chunk, including API conventions before route changes.
  - [ ] Preserve unrelated work. Initial inspection found an untracked src/res/ directory; do not modify or delete it.
  - [ ] Update relevant documentation in the same chunk as behavior changes.
  - [ ] Complete each chunk’s tests and browser verification, report results and limitations, and stop for review before beginning the next chunk.

  Existing documents contain historical descriptions that differ from current code. This plan and the user’s confirmed decisions govern this feature. Update conflicting current-status
  guidance where necessary without rewriting unrelated historical material.

  Browser inspection already established:

  - DJs have the desired search toolbar, disabled grid control, sortable headers, dense bordered table, and horizontally scrolling content.
  - The existing DJ modal can overflow a short viewport, leaving its header and Submit button out of view.
  - The live Shows dataset is empty, and its current page displays the older “Archive / Shows” heading.
  - POST /api/admin/create-show exists but does not persist anything.

  Use agent-browser for all required browser checks. Capture fresh baselines before implementation; the planning screenshots in /tmp are temporary.

  ## Chunk 1 — Reusable components, demonstrated through DJs

  Review outcome: DJs use shared components with the same appearance and existing functionality. The shared modal also works at short and narrow viewport sizes.

  ### Shared table and toolbar

  - [ ] Extract a resource-neutral toolbar accepting search value/change callback, accessible search label, create-button label/callback, and optional disabled create state.
  - [ ] Preserve the current search placeholder, disabled grid button, selected table button, spacing, and square create button.
  - [ ] Extract a typed generic table using column definitions rather than hardcoded DJ markup.
  - [ ] Each column definition supplies a stable key, label, cell renderer, and comparator. The table receives rows, row-key accessor, caption, current sort, and sort callback.
  - [ ] Share filtering and sorting mechanics: trimmed case-insensitive substring matching, sorting a copied array, and active-column toggling. Resource adapters provide search text and
    comparators.

  - [ ] Preserve DJ sorting exactly: ID descending initially; new column ascending; active column toggles; relationship columns compare their first ID with the existing empty-value
    behavior.

  - [ ] Keep existing DJ search coverage and sanitized HTML rendering intact. Extract shared date, missing-value, and relationship-ID presentation where useful.
  - [ ] Share loading, retry, empty-dataset, and no-search-results presentation. Keep the toolbar available for an empty successfully loaded dataset.
  - [ ] Add an explicit “No DJs match your search” state rather than rendering a blank body.
  - [ ] Use resource-neutral CSS classes for shared elements. Preserve borders, wrapping, 250px cell-width cap, row opacity/hover behavior, and horizontal scrolling.
  - [ ] Add aria-sort to sortable headers.

  Use a small new resource-view composition for DJs and Shows if extending the existing DatabaseTableView would alter Tags. Leave the Tags page and its existing wrapper behavior
  unchanged.

  ### Shared onboarding components

  - [ ] Extract a generic onboarding modal responsible for overlay, dialog heading, close control, form layout, error area, Submit button, and pending state.
  - [ ] Extract resource-neutral labeled input/textarea controls supporting IDs, input types, required state, helper text, errors, and disabled state.
  - [ ] Keep resource form values, normalization, and validation in their own form components. Do not build a schema-driven form engine.
  - [ ] Extract the existing comma-separated tags field and missing-tag feedback into a shared component. Reuse validate-tags; never create tags on blur.
  - [ ] Ignore stale tag-validation responses after edits, closure, or reopening. A validation-service failure must not prevent final server-side submission.
  - [ ] Extract shared mutation-error formatting so both loaders show resource-specific copy, HTTP status, and readable API errors consistently. Keep DJ multipart serialization unchanged.
  - [ ] Migrate OnboardDJModal to these primitives. Preserve all current DJ fields, image-upload validation, payload construction, and success refresh behavior.
  - [ ] Keep the DJ image picker resource-specific for now; Shows will use a URL input.

  Define common modal behavior once:

  - Opening starts a fresh form session with cleared errors.
  - Close button and Escape close an idle modal; backdrop clicks do not dismiss it.
  - Focus enters the dialog, stays within it, and returns to the opener on closure.
  - While submitting, disable fields, Submit, and dismissal to prevent duplicate submissions and abandoned in-flight sessions.
  - Failure preserves values and shows the error inside the modal.
  - Success closes the modal and triggers the resource refresh without resetting table search or sort.
  - A refresh failure after successful creation is a page-loading error, not a creation failure.
  - Constrain the panel to available viewport height and make its content scrollable. Keep heading, close control, and Submit reachable; preserve the undimmed top bar.

  ### Verification and review gate

  - [ ] Run focused shared-helper and existing DJ tests, including unchanged multipart requests and image behavior.
  - [ ] Verify with agent-browser: DJ sorting, search, no matches, modal opening/closing, validation, pending/failure states, and fresh state on reopening.
  - [ ] Compare before/after table and modal screenshots at desktop, short desktop, and narrow widths.
  - [ ] Verify Tags navigation and layout remain unchanged.
  - [ ] Update documentation describing shared component responsibilities and intentional modal behavior improvements.
  - [ ] Complete common checks below.
  - [ ] Stop for user review of the reusability refactor.

  ## Chunk 2 — Shows table using shared components

  Review outcome: Shows visually matches DJs and supports search, sorting, and complete loading/empty/error states.

  ### Data and presentation

  - [ ] Add an admin-specific Show response type extending the existing Show shape with createdAt.
  - [ ] Return createdAt from GET /api/admin/shows; it is already selected from the database.
  - [ ] Keep public archive transformer/export contracts unchanged. Compose the admin response around the existing transformer.
  - [ ] Update the browser row type so serialized timestamps are strings.
  - [ ] Replace the old Shows heading/layout with the shared resource view, toolbar, and table.
  - [ ] Configure columns in this exact order: id, created at, title, date, duration, image, DJs, tags, URL.
  - [ ] Render creation timestamps in the same UTC format as DJs.
  - [ ] Render broadcast dates as the UTC calendar date only, including existing records with non-midnight timestamps. Do not rewrite existing stored dates.
  - [ ] Render duration as HH:MM:SS, allowing hours above 23.
  - [ ] Render image URLs as text, matching DJ image-path presentation; show None when absent.
  - [ ] Render DJ/tag IDs as comma-separated values with None for empty arrays.
  - [ ] Render the show URL as readable linked text for HTTP(S) URLs. Render unsupported legacy values as plain text.
  - [ ] Show the shared + Show button disabled until onboarding is implemented in chunk 3.

  ### Search and sorting

  - [ ] Load Shows, DJs, and Tags to build search text using relationship names as well as IDs. Use ID-indexed lookup maps.
  - [ ] Search all displayed Show values, including formatted dates/duration, URLs, and resolved DJ/tag names.
  - [ ] Default to ID descending and use the shared header-toggle behavior.
  - [ ] Sort ID and duration numerically, dates chronologically, text case-insensitively, and relationship columns by first ID as DJs do.
  - [ ] Preserve deterministic ordering for equal values using stable input order.
  - [ ] Distinguish an empty database from a search with no matches.
  - [ ] Treat failure of the required resource/lookups load as a retryable page error. Ignore obsolete load results after unmount or a newer refresh.

  ### Verification and review gate

  - [ ] Add focused API-response and frontend tests for createdAt, column rendering, search, sort, and empty values.
  - [ ] Test numeric sorting, relationship-name searches, case-insensitive searches, optional image absence, and no results.
  - [ ] Test day rendering across positive and negative browser timezone offsets to ensure no calendar-day shift.
  - [ ] Use agent-browser with controlled response fixtures to inspect populated, loading, empty, and failed Shows states without seeding unrelated local data.
  - [ ] Compare Shows and DJs at matching viewport sizes; check horizontal scrolling and narrow layouts.
  - [ ] Document the admin-only response addition and Shows table behavior.
  - [ ] Complete common checks below.
  - [ ] Stop for user review of the Shows table.

  ## Chunk 3 — Complete Show onboarding

  Review outcome: An admin can create a Show, link existing DJs, reuse/create tags, and see the saved record after refresh.

  Implement internally in this order: form and pure validation, endpoint and transactional persistence, then loader/page integration. These are parts of one reviewable onboarding feature.

  ### Form and reusable selection

  - [ ] Enable + Show and open Onboard Show using the shared modal.
  - [ ] Render fields in this order: title, date, duration, image URL, DJs, tags, show URL.
  - [ ] Start fields empty. Do not prefill title, image, or tags from a selected DJ.
  - [ ] Use a native day-only date input. No time, timezone selector, hour, or minute field for the broadcast date.
  - [ ] Group duration inputs as hours, minutes, seconds; blank parts count as zero, but total duration must be positive.
  - [ ] Add a reusable searchable multi-select with typed option IDs, labels, controlled selection, loading/error states, and selected-item removal.
  - [ ] For DJs, display title (#id) to distinguish duplicate names; search by title or ID. Use labeled checkboxes in the filtered list for straightforward keyboard access.
  - [ ] Require at least one selected DJ. No inline DJ creation.
  - [ ] If no DJs exist, explain that a DJ must be created first and prevent submission.
  - [ ] Reuse the shared plain tags input and blur-validation helper behavior.
  - [ ] Refresh available DJs when opening a new onboarding session; lookup failure offers retry and blocks submission until resolved.

  ### Creation API contract

  Fill the existing authenticated POST /api/admin/create-show route. Do not implement modify/remove placeholders.

  The JSON request is:

  type CreateShowRequest = {
    title: string;
    date: string;      // Strict YYYY-MM-DD calendar date
    duration: number;  // Positive whole seconds
    url: string;       // Absolute HTTP(S) URL
    djs: number[];     // At least one existing DJ ID
    image?: string;    // Optional absolute HTTP(S) URL
    tags?: string[];   // Tag titles
  };

  - [ ] Define the runtime pattern and inferred request type beside the Shows routes; export through the resource barrel.
  - [ ] Use typed Fastify Body and AdminApiReply contracts and the injected database.
  - [ ] Normalize whitespace before semantic validation. Omit blank optional artwork and remove blank tag entries.
  - [ ] Validate real calendar dates, including leap days; reject impossible dates and timestamp strings.
  - [ ] Convert the accepted date to midnight UTC explicitly, without browser/server local-time interpretation.
  - [ ] Validate duration as a positive integer within PostgreSQL integer range. In the form, minutes/seconds must be integers from 0–59 and hours nonnegative.
  - [ ] Validate required and optional URLs as absolute HTTP(S) URLs.
  - [ ] Validate DJ IDs as positive integers, deduplicate them, and reject nonexistent IDs.
  - [ ] Allow duplicate Show titles; do not invent a uniqueness restriction.
  - [ ] Return 400 { error } for invalid input and 500 { error: "Internal Server Error" } for unexpected failures. Preserve existing authentication behavior.
  - [ ] Emit readable start, rejection, success, and failure logs following repository conventions; do not log full form bodies.

  ### Transaction and response

  - [ ] Validate/resolve DJ relationships inside the transaction, retaining foreign-key protection against concurrent deletion.
  - [ ] Reuse the existing Tags-module service inside that transaction. Deduplicate submitted tags case-insensitively and reuse existing tags.
  - [ ] Create missing tags using existing random-color and reviewed: false behavior.
  - [ ] Insert the Show, show_djs, and show_tags rows atomically. Failure must roll back all new records, including newly created tags.
  - [ ] Store absent image as database NULL; omit it from the response.
  - [ ] Return HTTP 201 with the same admin Show shape as the list endpoint, including generated ID/creation timestamp and sorted, unique relationship IDs.
  - [ ] Keep response date as an ISO UTC timestamp for compatibility with the existing read contract.
  - [ ] Add a createShow loader with injectable fetch for testing, JSON serialization, and shared error formatting.
  - [ ] On success close the modal and reload Shows plus lookup data, retaining the current query and sort.
  - [ ] Verify navigating to DJs reflects newly associated Shows through the existing relationship read behavior.

  ### Verification and review gate

  - [ ] Test valid request creation with multiple DJs, existing/new tags, optional artwork, and complete response shape.
  - [ ] Test whitespace-only title, missing fields, bad URLs, malformed dates, leap days, invalid durations, empty DJs, nonexistent DJs, and duplicate relationships.
  - [ ] Test unauthenticated/non-admin access, database errors, and transactional rollback after a later write fails.
  - [ ] Test form payload conversion, optional-field omission, duration conversion, and date-only round trips.
  - [ ] Test JSON loader behavior and readable JSON/non-JSON error responses.
  - [ ] Use agent-browser to verify field layout, DJ searching/selection/removal, tag feedback, required validation, pending state, retained values after errors, and fresh reopening.
  - [ ] Verify successful creation and list refresh against an isolated test database; do not silently create fixtures in the user’s existing dataset.
  - [ ] Verify persistence after reload, correct date display, associated IDs, and preserved search/sort.
  - [ ] Update API documentation, database date semantics, admin status, and the maintained checklist.
  - [ ] Complete common checks below.
  - [ ] Stop for user review of complete Show onboarding.

  ## Common checks and acceptance criteria

  For each chunk:

  - [ ] Run focused Bun tests for changed behavior.
  - [ ] Run bun run typecheck.
  - [ ] Run bun run admin:build.
  - [ ] Run the repository formatter, inspect its diff, then run bun run lint and git diff --check.
  - [ ] Run the full test suite before the final onboarding handoff.
  - [ ] Record agent-browser checks and screenshot locations, identifying fixture-backed versus real API verification.
  - [ ] Report any failing or unavailable checks explicitly.

  Final acceptance requires shared components actively used by both DJs and Shows—not merely renamed copies. Their table and modal structure must have a single implementation, with
  differences expressed through typed props, columns, and resource forms. Tags must remain unchanged while the shared components remain suitable for its later migration.
