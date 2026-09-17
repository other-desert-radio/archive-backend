# DJ Tables and Onboarding Implementation Plan

## Summary

Extend the existing authenticated React/Vite admin UI with:

- A Figma-aligned DJ table page.
- Client-side search and sorting.
- A reusable tag-input component.
- A DJ onboarding modal.
- A final transactional `POST /api/admin/create-dj` endpoint.

Current repository state:

- React/Vite frontend under `src/admin-ui/`.
- Fastify/Kysely/PostgreSQL backend.
- Authenticated admin API namespace: `/api/admin/*`.
- Current read-only resource endpoints: `GET /api/admin/djs`, `/shows`, and
  `/tags`.
- Current tag-validation endpoint: `POST /api/admin/validate-tags`.
- Current DJ creation scaffold: `POST /api/admin/create-dj` validates the
  request shape but does not persist anything yet.
- Existing DJ JSON fields: `id`, `title`, `bio`, optional `image`, optional
  `socials`, `shows`, and `tags`.
- Existing `djs` columns: `id`, `title`, `bio`, nullable `image`, and nullable
  `socials`.
- Existing tag JSON fields: `id`, `title`, and `color`.
- The DJ table renders `id`, `title`, `image`, `tags`, `socials`, `bio`, and
  `shows` with client-side filtering and sorting.

Follow the repository rule of implementing one small feature at a time, adding
focused tests and documentation, then stopping for review.

API route structure, authentication boundaries, shared response types, and
`ts-pattern` request validation are documented in
[`docs/api-routes.md`](api-routes.md). Read that guide before changing or adding
an API route.

## Reuse requirements

Treat the DJ implementation as the first consumer of shared archive UI patterns.
Components and helpers introduced here must be reusable by Shows and Tags
wherever their behavior is not DJ-specific.

- Keep modal shells, form layout, labels, text inputs, multiline editors,
  buttons, loading/error/empty states, and toolbar controls generic.
- Keep filtering, sorting, normalization, ID formatting, and search-value
  helpers data-driven or generic rather than tied to DJ property names.
- Put resource-specific column definitions and field configuration at the page
  boundary; do not duplicate shared component markup for Shows, DJs, or Tags.
- The first onboarding form accepts plain text, but its form primitives must be
  ready for reuse by future DJ, Show, and Tag forms.

## Figma Reference

Use these exact Figma nodes:

- [DJ table — node 174:762](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=174-762)
- [DJ onboarding modal — node 207:1052](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=207-1052)
- [Tags component — node 205:890](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=205-890)

The implementing agent should assume that Figma access is unavailable. Keep the
links and node IDs above for design tracking, but use the captured screenshots,
the measurements below, and this document as the implementation source of truth.
Do not block implementation on opening Figma or retrieving additional Figma
assets.

Important visual details:

- Space Mono styling, with regular, bold, and italic weights.
- Black 49px top bar with centered `OTHER DESERT RADIO / MANAGEMENT`.
- Black 172px left sidebar.
- Textured background already represented by
  `src/admin-ui/assets/background/background.jpeg`.
- DJ table canvas is approximately 1210px wide and scrolls horizontally.
- Toolbar contains a search field, a `grid | table` segmented control, and a
  `+ DJ` button.
- The table control remains visible with table selected; grid is
  disabled/deferred.
- Table columns, in Figma order:
  `id | title | image | tags | socials | bio | shows`.
- Table headers are centered.
- Active sort header is bold with a filled arrow.
- Inactive headers use normal weight with outlined arrows.
- Figma’s initial state sorts `id` descending.
- Image cells show the image URL/path as text, not an image preview.
- The modal overlay is black with approximately 60% opacity.
- The modal panel is approximately 656×758px, white, and centered.
- Modal fields appear in this order: `title | image | tags | socials | bio`.
- Modal title is `Onboard DJ`; close control is `x`.
- Submit button is approximately 128×52px with a black offset shadow.
- Existing tag examples use magenta `#ff03d1`, red `#ff2c2c`, blue `#57cfff`,
  and yellow `#ffe657`.
- Unknown tags use a white chip with red border and red text plus gray helper
  text.
- Tag colors should use a similar bright palette rather than arbitrary colors.
  Reuse an existing tag’s stored color when available; new tags should use a
  deterministic color from the documented palette, with `#ff03d1` as the default
  when no palette selection is available.

Do not copy generated Tailwind reference code directly. Adapt the design to the
existing CSS and React component structure. Reuse the existing shell and
background asset.

### Screenshot-specific handoff notes

The supplied screenshots should be treated as the visual acceptance reference
when Figma is unavailable:

- The main page is intentionally sparse and dense at the same time: a large
  textured content area, a compact toolbar, and a table that fills most of the
  remaining viewport.
- The black top bar spans the entire viewport. Its title is centered, with
  `MANAGEMENT` visibly bold compared with `OTHER DESERT RADIO /`.
- The sidebar is solid black and visually separated from the textured content.
  `- DJs` is bold while `- shows`, `- tags`, and `- upload` are regular weight.
- The content begins after the sidebar, with generous top spacing before the
  toolbar. Do not add a large `DJs` page heading above the toolbar in the
  Figma-aligned DJ view.
- The search field is a white rectangle with a thin black border and the literal
  placeholder `search...`; it is wider than the segmented control.
- The segmented control consists of two equal white bordered rectangles labelled
  `grid` and `table`. The selected `table` segment has the filled/white selected
  treatment shown in the design; grid remains visible but is not implemented.
- The `+ DJ` button is a compact white bordered rectangle aligned to the right
  edge of the content area. Its label is bold.
- The table uses thin black inner borders on a translucent/white textured
  surface. Header text is centered; body cells are intentionally roomy and
  vertically aligned to the top.
- The table is wider than many viewports. Preserve horizontal scrolling instead
  of collapsing columns or converting the table into cards.
- The table header uses a small downward arrow beside every label. The active
  `id` header is bold and uses the filled black arrow; inactive arrows are
  outlined.
- The Figma main-table screenshot uses `title`, while one modal/background
  composition uses `name`. The repository’s canonical field is `title`; do not
  introduce a second `name` field.
- The table screenshot shows `id`, `title`, `image`, `tags`, `socials`, `bio`,
  and `shows` in that order. Keep this order even if the current read-only table
  has fewer columns.
- The image column is a text/path column. Do not render thumbnails in this table
  slice.

The modal screenshot shows the page underneath dimmed but still recognizable:

- The black overlay begins below the fixed 49px top bar, leaving the header
  fully visible and undimmed while dimming the sidebar and table content beneath
  it. Use roughly 60% opacity.
- The white modal is centered and has generous internal whitespace.
- `Onboard DJ` is a large bold Space Mono heading at the upper left of the
  panel; the `x` close control is at the upper right.
- Labels are in a narrow left column. Inputs begin in a consistent right column
  and share the same width and black border treatment.
- The title and image controls are single-line fields.
- The tags control is a single-line field that can expand into chips.
- Socials and bio are multiline bordered editors. The Figma reference shows B/I
  toolbar buttons in both, but those buttons are explicitly deferred from the
  first implementation slice; keep the editor geometry ready for them later.
- The Submit button is centered near the bottom, with a thick black outline and
  a short black offset shadow below it. Preserve the offset-shadow appearance
  rather than using a rounded modern button style.
- The screenshot’s sample text is illustrative only. Do not use sample values as
  defaults in the real form.

The tags breakout is a behavior diagram, not a separate page to reproduce:

- The top example shows an input with typed text, a gray inline completion, and
  a bordered dropdown containing an existing `dance` tag. Gray inline completion
  and Tab-to-accept are nice-to-have behavior, not base scope.
- The middle example shows comma-separated input becoming colored chips after
  editing completes. Each chip is a compact rectangle with an `x` removal
  affordance.
- The lower example shows an unknown `foobar` chip with a white background, red
  border, and red text, followed by gray explanatory text saying it will be
  created after submit.
- The arrows and captions such as `when editing is complete:` and
  `when one doesn’t exist:` are explanatory annotations from the design
  document. Do not render those arrows or captions in the production form.
- Existing tag colors are visual metadata. Reuse the API’s existing `color`
  field when available; new tags use the agreed bright palette, beginning with
  the default `#ff03d1` when no palette selection is available.

## Implementation Sequence

### 1. Add the `socials` archive field

Checklist:

- [x] Add a new migration for nullable `djs.socials`.
- [x] Update Kysely database types and DJ transformer types.
- [x] Include optional socials in `GET /api/admin/djs`.
- [x] Add focused transformer and route tests.
- [x] Update database and admin documentation.
- [ ] Run migration, typecheck, and tests, then stop for review.

Add a new nullable `socials` text column to `djs` using a new Kysely migration.
Do not modify an already-applied migration.

Update database table types, DJ transformer input/output types,
`GET /api/admin/djs`, existing DJ API tests, and database/admin documentation.

Use this output shape:

```ts
type DJsJSON = {
  id: number;
  title: string;
  bio: string;
  image?: string;
  socials?: string;
  shows: number[];
  tags: number[];
};
```

Nullable database values should be omitted from JSON, matching the existing
`image` behavior.

The first editor stores plain text converted to safe HTML. The server must
sanitize stored/output HTML using an established sanitizer. Limit formatting to
paragraphs, line breaks, strong text, emphasis, and basic list/indentation
markup. Do not add arbitrary raw HTML editing.

Stop for migration and API review before continuing.

### 2. Refactor the DJ table to match Figma

Checklist:

- [x] Add the Figma toolbar layout and preserve the undimmed top bar.
- [x] Add the search field with the `search...` placeholder.
- [x] Add the disabled `grid | table` segmented control.
- [x] Add the `+ DJ` button without implementing modal submission yet.
- [x] Render all seven columns in the specified order.
- [x] Add client-side filtering and sortable headers with ID descending
      initially.
- [x] Render image paths as text and relationship values as IDs.
- [x] Preserve horizontal table scrolling and dense black borders.
- [x] Add pure helper tests for filtering and sorting.
- [x] Run the admin build and stop for visual review.

Keep loading, empty, and error handling directly in `DJsPage`. The DJ page does
not use `DatabaseTableView`, `Header`, or `Body`; Shows and Tags retain their
existing shared wrapper.

`DJsPage` owns the search query, active sort column, sort direction, modal
state, loaded DJs, and available tags.

Initial sort is `id` descending. Clicking an inactive header selects that column
ascending; clicking the active header toggles direction. Only one header is
active. Sort numeric fields numerically and text fields case-insensitively.

Search is client-side and case-insensitive. Match against DJ ID, title,
image/path text, bio, socials, tag IDs, and existing tag titles. Preserve the
full-array API; do not add query parameters or pagination. Matching-text bolding
is deferred as a nice-to-have.

Render columns in Figma order. Render `tags` and `shows` as IDs, preserving the
current relationship contract. Use loaded tag titles only to improve search
matching. Render image paths/URLs as text and show `None` when absent. Preserve
horizontal overflow. Keep a small, equal 16px inset on both sides of the table
wrapper.

Extract filtering, sorting, and search-value construction into pure, reusable
helpers so they can be tested without a browser DOM and later configured for
Shows and Tags.

### 3. Build the onboarding modal first

Checklist:

- [x] Open the modal from `+ DJ`.
- [x] Render a backdrop beginning below the fixed top bar; never dim the top
      bar.
- [x] Render the centered white modal shell, close control, and Submit button.
- [x] Add required title and bio validation.
- [x] Add optional image/path and socials fields.
- [x] Leave tags as plain text until the later tags-component slice.
- [x] Preserve plain-text line breaks and indentation.
- [ ] Defer B/I controls while keeping editor geometry compatible with them
      later.
- [ ] Keep image drag/drop path extraction deferred.
- [ ] Close and refresh the table after a successful callback while preserving
      search/sort state.
- [ ] Add modal/form behavior tests or pure state tests.
- [x] Run the admin build and stop for visual review.

The reusable modal shell and `OnboardDJModal` are now opened by the DJ table’s
`+ DJ` button. All five form fields and a styled Submit button are now present.
The fields are controlled plain-text inputs: `title`, optional `image` URL/path,
`tags`, multiline `socials`, and multiline `bio`. Client-side validation now
requires non-whitespace `title` and `bio`; API submission remains a subsequent
review step.

Form fields:

- `title`: required.
- `image`: optional URL/path text input.
- `tags`: plain-text input for this first modal slice; the reusable component is
  added later.
- `socials`: optional multiline plain-text editor.
- `bio`: required multiline plain-text editor.

When the `tags` field is blurred, call the authenticated
`POST /api/admin/validate-tags` endpoint with the comma-separated tag values.
For now, if one or more submitted tags are missing from the database, show only
the plain helper copy that those tags will be created after submit. Do not add
chips, autocomplete, dropdowns, inline completion, or other fancy tags UI in
this slice. Clear the helper copy when validation finds no missing tags or when
the field is edited again.

Use plain text for all modal fields while preserving newlines and indentation.
Keep the field-row, input, textarea, validation-message, and submit-button
primitives resource-agnostic so Shows and Tags can use the same form system. Do
not add B/I controls in this first editor slice. Convert plain text to escaped
safe HTML on submit, preserving line breaks and leading indentation. The server
sanitizes the resulting HTML before persistence.

Image behavior is limited to URL/path text input. Do not implement browser
drag-and-drop file path extraction; browsers do not expose a reliable full local
filesystem path. Defer real upload/storage until a separate image-serving or
upload design exists.

Modal behavior:

- Render `role="dialog"` and `aria-modal="true"`.
- Label the dialog `Onboard DJ`.
- Close through the `x` control.
- Keep submission errors inside the modal.
- Disable submit while the request is pending.
- On success, close the modal, refresh DJ data, and preserve the current search
  query and sort state.

Before adding the endpoint, test the modal with a local submit callback and
verify the Figma layout using the production Vite build.

### 4. Build the reusable tags component

The backend now provides the tag-validation primitive needed by onboarding:
`POST /api/admin/validate-tags` accepts `{ tags: string[] }`, loads existing tag
titles, and returns `{ valid: string[]; invalid: string[] }`. Matching is
case-insensitive and trims incoming values; the returned values retain the
trimmed incoming spelling. The route is authenticated and returns `400` for a
body that is not an object containing an array of strings, or `500` for an
unexpected database failure.

The first onboarding integration should call this endpoint when the plain-text
tags field loses focus and display only the missing-tag helper copy. It should
not render the Figma tags breakout behavior yet; chip rendering, autocomplete,
and other richer interactions remain deferred.

This endpoint is validation support, not tag persistence. Unknown tags remain
creation candidates until the final transactional DJ endpoint is implemented.

Implement the controlled tags input after the modal’s initial plain-text form
has been reviewed. It should support matching existing tags, comma-separated
input, trimming, case-insensitive deduplication, removable colored chips, and
unknown-tag helper text. Use the loaded tag metadata for chip colors and the
validation endpoint when server confirmation is useful; do not create or modify
tags from the component. Add pure helper tests and stop for review after the
admin build.

### 5. Add the create endpoint last

Checklist:

- [x] Define and validate `CreateDJRequest` with a `ts-pattern` pattern and
      `P.infer`.
- [x] Add the authenticated `POST /api/admin/create-dj` validation scaffold.
- [ ] Add focused route tests for the scaffold's valid and invalid request
      paths, including its authenticated admin boundary.
- [ ] Implement persistence behind the authenticated
      `POST /api/admin/create-dj` endpoint.
- [ ] Convert submitted plain text to escaped safe HTML and sanitize it.
- [ ] Resolve existing tag titles case-insensitively.
- [ ] Create missing tags transactionally using the documented color palette.
- [ ] Insert the DJ and direct `dj_tags` rows in the same transaction.
- [ ] Return HTTP `201` with the normalized DJ response.
- [ ] Add validation, authorization, success, duplicate, and rollback tests.
- [ ] Update API, database, and admin documentation.
- [ ] Run the full relevant verification suite and stop for review.

The current DJ route scaffold exposes:

```text
GET  /api/admin/djs
POST /api/admin/create-dj   # validates the request, persistence deferred
POST /api/admin/modify-dj   # placeholder
POST /api/admin/remove-dj   # placeholder
```

`POST /api/admin/create-dj` currently validates only the structural request
shape from `CreateDJRequestPattern`. A valid request returns no created record
and performs no database writes. Before persistence, bring its request/reply
generics into the shared route convention (`Body` and `AdminApiReply`) and add
focused route coverage; the scaffold does not persist data yet.

The create route remains `/api/admin/create-dj` throughout this feature.

The current admin API also exposes:

```text
GET  /api/admin                    # authenticated status route
GET  /api/admin/shows
GET  /api/admin/tags
POST /api/admin/validate-tags
POST /api/admin/modify-tag         # placeholder
```

`POST /api/admin/validate-tags` currently accepts:

```json
{ "tags": ["dance", " New Tag "] }
```

and returns the trimmed incoming values split into `valid` and `invalid` based
on case-insensitive matches against existing database tag titles. It does not
insert unknown tags, assign colors, or create DJ relationships. The pure
normalization helper is covered separately; route-level success, invalid-body,
database-failure, and authentication tests remain part of the API work.

All of these routes are authenticated through the top-level admin boundary. The
route plugin layout and shared `AdminApiReply`/`TypedDatabase` types are defined
in [`docs/api-routes.md`](api-routes.md).

Create endpoint:

```text
POST /api/admin/create-dj
```

Request type:

```ts
const CreateDJRequestPattern = {
  title: P.string,
  image: P.optional(P.string),
  tags: P.optional(P.array(P.string)),
  socials: P.optional(P.string),
  bio: P.string,
} as const;

type CreateDJRequest = P.infer<typeof CreateDJRequestPattern>;
```

Keep the pattern and inferred type in `src/admin/routes/djs/types.ts`, export
the type through `src/admin/routes/djs/index.ts`, and validate request bodies
with `isMatching` before using them. Use the shared `AdminApiReply` response
type and return `400` for validation failures.

The inferred request shape is:

```ts
type CreateDJRequest = {
  title: string;
  image?: string;
  tags?: string[];
  socials?: string;
  bio: string;
};
```

Validation:

- `title` is required and must contain non-whitespace text.
- `bio` is required and must contain non-whitespace text.
- `image` and `socials` are optional.
- Tags are optional.
- Trim title, image, socials, and tag titles.
- Remove empty tag titles.
- Do not add a duplicate-title restriction for DJs because the current schema
  does not define one.

Persistence must occur inside one PostgreSQL transaction:

1. Normalize and resolve submitted tag titles case-insensitively.
2. Reuse existing tags when present.
3. Insert missing tags with a deterministic color from the Figma-like palette;
   use `#ff03d1` as the default starting color.
4. Insert the DJ.
5. Insert all direct `dj_tags` relationships.
6. Return the created DJ and relationship IDs.

The transaction must roll back completely if any step fails. Do not create show
relationships during DJ onboarding.

Suggested success response: HTTP `201` with the normalized DJ JSON object, a new
ID, sanitized bio, optional image/socials, `shows: []`, and direct tag IDs.

Return `400` for invalid data, `401` for unauthenticated access, `403` for
non-admin access, and `500 { "error": "Internal Server Error" }` for unexpected
database failures.

Add focused route tests for validation, authentication, existing tags, new tags,
case-insensitive tag reuse, duplicate submitted tags, transaction rollback, and
successful response shape.

## Documentation and Verification

Update documentation in the same implementation chunk as each behavior change:

- `docs/DATABASES.md` for the `socials` column, safe HTML contract, and tag
  persistence.
- `docs/ADMIN_UI_PLAN.md` for the incremental delivery sequence and current
  status.
- `docs/README.md` for API behavior and verification commands.
- `docs/api-routes.md` for route structure, authentication, and typing
  conventions.
- This plan remains the handoff document for later agents.

Verification per chunk:

- [ ] Focused Bun tests.
- [ ] `bun run admin:build`.
- [ ] `bun run typecheck`.
- [ ] `bun run lint`.
- [ ] `git diff --check`.
- [ ] Visual verification through the authenticated `/admin#djs` page using the
      existing container/watch workflow.

Out of scope:

- DJ row editing or `/dj/modify`.
- Grid view implementation.
- Image uploads or file storage.
- B/I controls and full rich-text editing.
- Server-side search, pagination, or filtering.
- Tag management UI.
- Show-to-DJ relationship editing.
- Authentication or deployment changes.
