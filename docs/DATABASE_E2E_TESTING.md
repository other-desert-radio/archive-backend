# Isolated database end-to-end testing

Use this runbook when an API or admin UI change must be verified against a real
database without adding, changing, or deleting records in the regular local
archive database.

This starts a disposable PostgreSQL container on port `55432` and a temporary
API on port `3001`. It does not use the Compose `archive_postgres_data` volume.
The database container is removed at cleanup, so all test records disappear.

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
