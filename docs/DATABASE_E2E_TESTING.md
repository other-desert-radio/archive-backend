# Isolated database end-to-end testing

Use this runbook when an API or admin UI change must be verified against a real
database without adding, changing, or deleting records in the regular local
archive database.

The manual workflow below starts a disposable PostgreSQL container on port
`55432` and a temporary API on port `3001`. It does not use the Compose
`archive_postgres_data` volume. The database container is removed at cleanup, so
all test records disappear.

## Prerequisites

- Run from the repository root.
- Do not use these commands with production credentials or ports.
- Build the admin bundle first if the browser UI will be checked:

  ```sh
  bun run admin:build
  ```

## Start the isolated database

Use the exact container name so cleanup can target only this temporary resource:

```sh
docker run --detach --rm --name archive-show-e2e \
  --env POSTGRES_DB=archive_e2e \
  --env POSTGRES_USER=admin \
  --env POSTGRES_PASSWORD=archive_e2e_dev \
  --publish 55432:5432 \
  postgres:16-alpine

docker exec archive-show-e2e pg_isready -U admin -d archive_e2e
```

Wait until `pg_isready` reports that the database is accepting connections, then
apply the repository migrations to that database only:

```sh
DATABASE_URL=postgres://admin:archive_e2e_dev@localhost:55432/archive_e2e \
  bun src/db/migrate.ts latest
```

## Start a temporary API

Run this in a separate terminal and leave it running during verification:

```sh
PORT=3001 \
DATABASE_URL=postgres://admin:archive_e2e_dev@localhost:55432/archive_e2e \
BETTER_AUTH_SECRET=isolated-e2e-development-secret-not-for-production \
BETTER_AUTH_URL=http://localhost:3001 \
ADMIN_BASIC_USERNAME=admin \
ADMIN_BASIC_PASSWORD=admin \
bun src/server.ts
```

The temporary secret is only for this disposable local process. Use a suitably
long random value if Better Auth warns about its length.

## Exercise the behavior

Create only the prerequisite records needed by the feature, then perform the
workflow through the authenticated API or UI. For example, Show creation needs
an existing DJ:

```sh
curl --silent --show-error --user admin:admin \
  --form-string title='E2E DJ' \
  --form-string bio='Isolated test DJ' \
  http://localhost:3001/api/admin/create-dj

curl --silent --show-error --user admin:admin \
  --header 'content-type: application/json' \
  --data '{
    "title":"E2E Show",
    "date":"2026-09-24",
    "duration":3661,
    "url":"https://example.test/show",
    "image_small":"https://example.test/small.jpg",
    "image_large":"https://example.test/large.jpg",
    "djs":[1],
    "tags":["E2E Tag"]
  }' \
  http://localhost:3001/api/admin/create-show

curl --silent --show-error --user admin:admin \
  http://localhost:3001/api/admin/shows
```

For browser verification, configure Basic Auth on the browser session and use a
credential-free URL. Do not put `admin:admin@` in the URL: this version of
`agent-browser` retains credentials in the document URL, which breaks relative
admin API fetches.

```sh
agent-browser --session database-e2e-verify set credentials admin admin
agent-browser --session database-e2e-verify open http://localhost:3001/admin/#shows
agent-browser --session database-e2e-verify wait 500
agent-browser --session database-e2e-verify snapshot -i
agent-browser --session database-e2e-verify screenshot /tmp/database-e2e-shows.png
```

Confirm the reloaded table shows the expected persisted values, formatted date
and duration, and relationship IDs. Record the commands and screenshot path in
the feature handoff.

## Cleanup

Stop the temporary API with `Ctrl-C` in its terminal. Then remove only the named
temporary database container:

```sh
docker stop archive-show-e2e
```

Because the container was started with `--rm`, stopping it deletes the temporary
database automatically. Confirm cleanup without affecting Compose services:

```sh
docker ps --all --filter name=archive-show-e2e --format '{{.Names}}'
curl --silent --output /dev/null --write-out '%{http_code}' http://localhost:3001/health
```

The expected output is no container name and `000` for the stopped temporary
API. Never run `docker compose down -v` as part of this workflow: it can remove
the persistent local archive volume.

## Automated editing coverage

From the repository root, run the integration runner script:

```sh
./scripts/run-integration-tests
```

`bun run test:integration` is an equivalent shortcut. The
[runner script](../scripts/run-integration-tests) requires Docker with Compose
and a running Docker daemon. It builds the API/admin bundle and Playwright test
image, starts PostgreSQL, applies migrations, waits for the API service, and
runs the browser tests. No manual database setup, host dependency installation,
or separate API process is needed.

The script uses `compose.integration.yml` with the project name
`archive-backend-integration`. Services communicate inside the Docker network;
the automated workflow does not publish host ports or use the regular local
archive database. Each test creates a uniquely named DJ through the
authenticated API; no shared seed or execution order is required.

The runner returns the test command's exit status and uses an exit trap to
remove its containers, network, and test database volumes, including after test
failure. Its volume cleanup is scoped to the integration project; the manual
workflow's warning about the regular Compose volume still applies.

Coverage includes individual metadata edits, optional-field clearing, all table
columns, saved values after reload and editor reopening, direct and inherited
tags, image addition/replacement/removal and crop cancellation, required-field
validation, invalid images, and Cancel/Escape dismissal. Image assertions fetch
both authenticated WebP variants and check their dimensions. Creation is fixture
setup; DJ and Show onboarding UI coverage is outside this suite. Tag onboarding
coverage in `integration-tests/onboard-tag.spec.ts` verifies persisted metadata,
reviewed state, existing-title reuse, local validation, failed-submit retention,
dirty dismissal, and phone layout.

Tag drafts commit synchronously on blur, so subsequent chip removal cannot be
overwritten by a delayed commit using an older selection. The integration suite
checks that removing all remaining direct tags persists an empty assignment.

### Show update API coverage

`integration-tests/modify-show-api.spec.ts` runs against the same disposable
PostgreSQL/API stack. Each test creates its own Show and prerequisite DJs
through API fixtures. Coverage verifies metadata replacement, image/tag
clearing, case-insensitive tag reuse, new tags, DJ-link replacement and its
inverse DJ response, preservation of identity and creation timestamp, invalid
requests, and unknown Shows. Persisted state is reloaded through the API after
mutations and rejections. `integration-tests/edit-show.spec.ts` additionally
exercises table/grid entry points, every editable field, reload/reopening,
DJ-link replacement, existing and focused-draft tags, image URL
clearing/addition, required-field validation, discard paths and reversion,
retained values after failure, submission protection, unresolved-tag retry, and
390px/320px layouts. Tests use a Los Angeles timezone to verify UTC calendar
date prefilling. The existing modal suite continues to cover Show creation after
shared-field extraction.

### Tag update API coverage

`integration-tests/modify-tag-api.spec.ts` creates isolated DJ/Show fixtures and
assigns one tag to both. Direct PostgreSQL assertions against only the
disposable Compose database verify tag identity/timestamp and relationship row
IDs remain unchanged. API reloads check normalized metadata and reviewed state;
rejection, case-only rename, and metadata clearing checks verify persisted
behavior. Discriminated `edit_type: "review"` updates are tested in both
directions, including repeated values, metadata and relationship preservation,
invalid/mixed requests, and unknown targets.

### Tag editor browser coverage

`integration-tests/edit-tag.spec.ts` creates uniquely named tags and linked
DJ/Show fixtures in the disposable stack. It checks prefilling, every editable
field through reload/reopening, optional metadata clearing, unchanged-save
review, inline chip preview, local validation and server duplicate rejection,
failed-save draft retention, submission protection, all dismissal paths,
reversion, discard, clean reopening, focus restoration/containment, and
390px/320px action reachability. Navigation to linked DJ/Show editors verifies
refreshed titles and colors. Shared DJ/Show/tag-input modal regressions remain
in the complete suite.

### Inline Tag review coverage

`integration-tests/review-tag.spec.ts` creates isolated tags and checks the
Review prompt, both boolean answers and repeated saves, exact keyed payloads,
metadata preservation, persisted values after reload, keyboard dismissal and
saving, focus restoration, retained errors and retry, pending-request
protection, and equal-height reachable actions at 390px and 320px. It also
verifies the full Tag editor still marks saved metadata reviewed. All tests run
in the disposable Compose stack alongside existing editor and toolbar
regressions.

### Tag deletion API coverage

`integration-tests/remove-tag-api.spec.ts` verifies the impact preview for a tag
assigned directly to a DJ and inherited through a linked Show. It checks
permanent deletion and cascaded assignment removal with direct PostgreSQL
assertions against the disposable database, then reloads Shows and DJs to verify
other metadata, relationships, and tags remain intact. Repeated deletion and
preview return `404`; unused tags return empty impact lists and can be deleted.

### Tag deletion browser coverage

`integration-tests/delete-tag.spec.ts` mocks reads and deletions to verify
impact labels, focus containment/restoration, all cancellation paths, loading
and retry, obsolete responses after closure, pending-request protection, failed
deletion and retry, retained search/sort, and long-list action reachability at
390px and 320px. Real database deletion and cascade coverage remains in the
separate `remove-tag-api.spec.ts` suite.

### Show image URL coverage

`integration-tests/modify-show-api.spec.ts` verifies both URLs persist and
reload independently and invalid or missing image fields leave the Show
unchanged. `integration-tests/edit-show.spec.ts` covers prefilling, editing each
variant, required-field rejection, draft retention, reload/reopening, and
390px/320px layouts. The shared creation modal regression supplies both required
URLs. `tests/db/show-image-urls-migration.test.ts` uses an explicit disposable
`SHOW_MIGRATION_TEST_DATABASE_URL` to check backfill, null rejection, atomic
failure, and rollback; otherwise it skips.

### Mixcloud import queue interaction coverage

`integration-tests/mixcloud-import-queue.spec.ts` mocks source rows, readiness
counts, DJ/tag resolution, creation, and reloads. It writes no archive records.
It checks queue membership/order independent of table state, exclusions, Save
and Skip counts, repeated-import success, reopening, empty/final closure,
discard confirmation and focus restoration, pending-request protection,
failed-save retry, post-commit reload failure, stale reload protection, and
390px/320px action reachability. Persistence and concurrency remain covered by
`tests/db/import-show.test.ts` against an explicitly supplied disposable
database.
