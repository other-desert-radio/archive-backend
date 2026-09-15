# DJ Tables and Onboarding Implementation Plan

## Summary

Extend the existing authenticated React/Vite admin UI with:

- A Figma-aligned DJ table page.
- Client-side search and sorting.
- A reusable tag-input component.
- A DJ onboarding modal.
- A final transactional `POST /api/admin/djs` endpoint.

Current repository state:

- React/Vite frontend under `src/admin-ui/`.
- Fastify/Kysely/PostgreSQL backend.
- Authenticated admin API namespace: `/api/admin/*`.
- Existing read-only endpoints: `GET /api/admin/djs`, `/shows`, and `/tags`.
- Existing DJ JSON fields: `id`, `title`, `bio`, optional `image`, `shows`, and `tags`.
- Existing `djs` columns: `id`, `title`, `bio`, nullable `image`.
- Existing tag JSON fields: `id`, `title`, and `color`.
- Current DJ table only renders ID, DJ title, bio, and image.

Follow the repository rule of implementing one small feature at a time, adding focused tests and documentation, then stopping for review.

## Figma Reference

Use these exact Figma nodes:

- [DJ table — node 174:762](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=174-762)
- [DJ onboarding modal — node 207:1052](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=207-1052)
- [Tags component — node 205:890](https://www.figma.com/design/BzM2IkYW1taFeepxrz8ue0/Other-Desert-Radio?node-id=205-890)

Important visual details:

- Space Mono styling, with regular, bold, and italic weights.
- Black 49px top bar with centered `OTHER DESERT RADIO / MANAGEMENT`.
- Black 172px left sidebar.
- Textured background already represented by `src/admin-ui/assets/background/background.jpeg`.
- DJ table canvas is approximately 1210px wide and scrolls horizontally.
- Toolbar contains a search field, a `grid | table` segmented control, and a `+ DJ` button.
- The table control remains visible with table selected; grid is disabled/deferred.
- Table columns, in Figma order: `id | title | image | tags | socials | bio | shows`.
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
- Existing tag examples use magenta `#ff03d1`, red `#ff2c2c`, blue `#57cfff`, and yellow `#ffe657`.
- Unknown tags use a white chip with red border and red text plus gray helper text.

Do not copy generated Tailwind reference code directly. Adapt the design to the existing CSS and React component structure. Reuse the existing shell and background asset.

## Implementation Sequence

### 1. Add the `socials` archive field

Add a new nullable `socials` text column to `djs` using a new Kysely migration. Do not modify an already-applied migration.

Update database table types, DJ transformer input/output types, `GET /api/admin/djs`, existing DJ API tests, and database/admin documentation.

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

Nullable database values should be omitted from JSON, matching the existing `image` behavior.

The first editor stores plain text converted to safe HTML. The server must sanitize stored/output HTML using an established sanitizer. Limit formatting to paragraphs, line breaks, strong text, emphasis, and basic list/indentation markup. Do not add arbitrary raw HTML editing.

Stop for migration and API review before continuing.

### 2. Refactor the DJ table to match Figma

Keep loading, empty, and error handling. Extend `DatabaseTableView` with an optional heading visibility prop so the DJ page can omit the existing large `Archive / DJs` heading while Shows and Tags retain their current behavior.

`DJsPage` owns the search query, active sort column, sort direction, modal state, loaded DJs, and available tags.

Initial sort is `id` descending. Clicking an inactive header selects that column ascending; clicking the active header toggles direction. Only one header is active. Sort numeric fields numerically and text fields case-insensitively.

Search is client-side and case-insensitive. Match against DJ ID, title, image/path text, bio, socials, tag IDs, and existing tag titles. Preserve the full-array API; do not add query parameters or pagination. Matching-text bolding is deferred as a nice-to-have.

Render columns in Figma order. Render `tags` and `shows` as IDs, preserving the current relationship contract. Use loaded tag titles only to improve search matching. Render image paths/URLs as text and show `None` when absent. Preserve horizontal overflow.

Extract filtering, sorting, and search-value construction into pure helpers so they can be tested without a browser DOM.

### 3. Build the reusable tags component

Create a controlled React tags input component that receives existing tags and emits tag titles.

Base behavior:

- Typing filters the existing tag list.
- Matching existing tags appear in a dropdown.
- Clicking a dropdown option adds/fills the tag.
- Comma-separated typing or paste is split on commas.
- Surrounding whitespace is trimmed.
- Empty entries are ignored.
- Existing tags match case-insensitively while preserving existing display casing.
- Submitted tag titles are deduplicated case-insensitively.
- Completed editing or focus change converts pending text into chips.
- Chips have an `x` removal control.
- Unknown tags remain visible as red chips and display the helper message from the Figma design.

Deferred behavior:

- Gray inline autocomplete text.
- Tab-to-complete behavior.
- Tag editing after a DJ is created.
- Tag color management.

Add pure helper tests for comma parsing, trimming, matching, deduplication, existing-tag selection, and unknown-tag detection.

### 4. Build the onboarding modal

Add a reusable `OnboardDJModal` opened by the DJ table’s `+ DJ` button.

Form fields:

- `title`: required.
- `image`: optional URL/path text input.
- `tags`: reusable tags component.
- `socials`: optional multiline plain-text editor.
- `bio`: required multiline plain-text editor.

Use plain text while preserving newlines and indentation. Do not add B/I controls in this first editor slice. Convert plain text to escaped safe HTML on submit, preserving line breaks and leading indentation. The server sanitizes the resulting HTML before persistence.

Image behavior is limited to URL/path text input. Do not implement browser drag-and-drop file path extraction; browsers do not expose a reliable full local filesystem path. Defer real upload/storage until a separate image-serving or upload design exists.

Modal behavior:

- Render `role="dialog"` and `aria-modal="true"`.
- Label the dialog `Onboard DJ`.
- Close through the `x` control.
- Keep submission errors inside the modal.
- Disable submit while the request is pending.
- On success, close the modal, refresh DJ data, and preserve the current search query and sort state.

Before adding the endpoint, test the modal with a local submit callback and verify the Figma layout using the production Vite build.

### 5. Add the create endpoint last

Add:

```text
POST /api/admin/djs
```

Do not add `/dj/create`; the authenticated admin namespace is the established API convention.

Request type:

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
- Do not add a duplicate-title restriction for DJs because the current schema does not define one.

Persistence must occur inside one PostgreSQL transaction:

1. Normalize and resolve submitted tag titles case-insensitively.
2. Reuse existing tags when present.
3. Insert missing tags with default color `#ff03d1`.
4. Insert the DJ.
5. Insert all direct `dj_tags` relationships.
6. Return the created DJ and relationship IDs.

The transaction must roll back completely if any step fails. Do not create show relationships during DJ onboarding.

Suggested success response: HTTP `201` with the normalized DJ JSON object, a new ID, sanitized bio, optional image/socials, `shows: []`, and direct tag IDs.

Return `400` for invalid data, `401` for unauthenticated access, `403` for non-admin access, and `500 { "error": "Internal Server Error" }` for unexpected database failures.

Add focused route tests for validation, authentication, existing tags, new tags, case-insensitive tag reuse, duplicate submitted tags, transaction rollback, and successful response shape.

## Documentation and Verification

Update documentation in the same implementation chunk as each behavior change:

- `docs/DATABASES.md` for the `socials` column, safe HTML contract, and tag persistence.
- `docs/ADMIN_UI_PLAN.md` for the incremental delivery sequence and current status.
- `docs/README.md` for API behavior and verification commands.
- This plan remains the handoff document for later agents.

Verification per chunk:

- Focused Bun tests.
- `bun run admin:build`.
- `bun run typecheck`.
- `bun run lint`.
- `git diff --check`.
- Visual verification through the authenticated `/admin#djs` page using the existing container/watch workflow.

Out of scope:

- DJ row editing or `/dj/modify`.
- Grid view implementation.
- Image uploads or file storage.
- B/I controls and full rich-text editing.
- Server-side search, pagination, or filtering.
- Tag management UI.
- Show-to-DJ relationship editing.
- Authentication or deployment changes.
