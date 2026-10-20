# Server installation

Install the backend on a Linux server using Docker Compose for the API and
PostgreSQL, and host Bun for migrations and initial administrator creation. Run
the commands as a dedicated deployment user that owns the checkouts, except
where `sudo` is shown. Examples use Ubuntu/Debian package names.

This guide describes the current branch's manual setup. Archive publication is
not implemented on `main`; preparing its checkout and credentials below is
optional and does not enable automatic publication.

## 1. Install prerequisites and Bun

Install Git, SSH tools, curl, unzip, and OpenSSL:

```sh
sudo apt update
sudo apt install -y git openssh-client curl unzip openssl
```

Install Docker Engine and the Compose plugin using the
[official Docker instructions](https://docs.docker.com/engine/install/ubuntu/).
Ensure the deployment user can run these commands before continuing:

```sh
docker version
docker compose version
```

Install host Bun to match the version currently pinned in `Dockerfile`:

```sh
curl -fsSL https://bun.sh/install | bash -s "bun-v1.4.2"
export PATH="$HOME/.bun/bin:$PATH"
bun --version
```

Keep the PATH addition in the deployment user's shell startup file for future
sessions. When the Dockerfile's Bun version changes, update the host version
too. See [Bun installation](https://bun.com/docs/installation) for supported
platforms and installation details.

## 2. Configure server Git access

Use separate repository-scoped deploy keys: read-only for pulling this backend,
and write-enabled for publishing generated content to `archive-site`. Keep your
personal key's passphrase; generate dedicated automation keys without one.
GitHub documents repository scope and write permissions in its
[deploy-key guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

```sh
mkdir -p ~/.ssh
chmod 700 ~/.ssh
ssh-keygen -t ed25519 -C "archive-backend server" -f ~/.ssh/archive_backend_deploy -N ''
ssh-keygen -t ed25519 -C "archive-site publisher" -f ~/.ssh/archive_site_deploy -N ''
chmod 600 ~/.ssh/archive_backend_deploy ~/.ssh/archive_site_deploy
cat ~/.ssh/archive_backend_deploy.pub
cat ~/.ssh/archive_site_deploy.pub
```

Use unused filenames; do not overwrite existing keys. In each GitHub repository,
open **Settings → Deploy keys → Add deploy key** and paste the corresponding
`.pub` file. Leave **Allow write access** unchecked for the backend and check it
for `archive-site`. Keep private key files on the server, outside Git.

Establish GitHub's host key interactively with each identity:

```sh
ssh -T -i ~/.ssh/archive_backend_deploy -o IdentitiesOnly=yes git@github.com
ssh -T -i ~/.ssh/archive_site_deploy -o IdentitiesOnly=yes git@github.com
```

Before accepting a new host key, compare its fingerprint against
[GitHub's published fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints).
GitHub's successful authentication message says it does not provide shell
access; the test can exit with status 1 despite successful authentication.

Clone the backend, replacing `BACKEND_REPOSITORY_SSH_URL` with this repository's
SSH clone URL:

```sh
mkdir -p ~/apps
cd ~/apps
git -c core.sshCommand="ssh -i $HOME/.ssh/archive_backend_deploy -o IdentitiesOnly=yes -o BatchMode=yes" clone BACKEND_REPOSITORY_SSH_URL archive-backend
cd ~/apps/archive-backend
git config core.sshCommand "ssh -i $HOME/.ssh/archive_backend_deploy -o IdentitiesOnly=yes -o BatchMode=yes"
```

Check out the intended release branch or commit before installing dependencies.
For an existing backend checkout, run only the `git config` command inside it.
`BatchMode=yes` makes unattended authentication fail promptly instead of asking
for a password.

## 3. Configure the application

Run subsequent backend commands from `~/apps/archive-backend`. Create `.env`
only for a fresh install; preserve an existing server configuration:

```sh
cp -n .env.example .env
chmod 600 .env
openssl rand -base64 32
```

Edit `.env` before starting the stack:

- Set `BETTER_AUTH_SECRET` to the generated random value. The production image
  rejects the example development secret.
- Set `BETTER_AUTH_URL` to the canonical public HTTPS origin, for example
  `https://archive-admin.example.com`.
- Set `POSTGRES_PASSWORD` to a unique secret. The Compose database URL embeds it
  directly, so a hexadecimal secret from `openssl rand -hex 32` is convenient.
- Confirm `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PORT`, and `PORT`. Defaults
  are database `archive`, user `admin`, PostgreSQL port `5432`, and API port
  `3000`. Leave optional trusted origins empty unless additional browser origins
  are needed.

Host migration/admin commands connect to localhost using the PostgreSQL settings
in `.env`. If `DATABASE_URL` is set in the shell, it takes precedence: ensure it
targets this server's intended database. Compose supplies its own internal
database URL to the API.

Configure an HTTPS reverse proxy or Cloudflare Tunnel to the API port. For a
tunnel, the local origin is `http://localhost:3000`; `BETTER_AUTH_URL` remains
the public HTTPS origin. Compose currently publishes the API and database ports
on all host interfaces. Restrict database access and direct API access with the
server firewall or reviewed Compose binding changes.

## 4. Install dependencies, migrate, and start

```sh
bun install --frozen-lockfile
docker compose up -d postgres
docker compose ps
```

Wait until PostgreSQL is healthy. Review pending files in `src/db/migrations/`,
then apply one migration at a time:

```sh
scripts/migrate up
```

Repeat for the reviewed migrations. If all pending migrations have been
reviewed, `scripts/run-migrations` applies them together. See
[database guidance](DATABASES.md) for migration conventions.

Build and start the API after migrating:

```sh
scripts/build-container
curl --fail http://localhost:3000/health
docker compose logs --tail=100 api
```

Use the configured port if it differs. The image builds the admin UI; a separate
host UI build is unnecessary. Container rebuilds do not apply migrations.

## 5. Create the initial administrator

From an interactive host terminal, with the same database and Better Auth
configuration as the API:

```sh
scripts/create-admin
```

Enter the administrator email and a password when prompted. The password is
hidden, requires confirmation, and must contain 8–128 characters. Do not put it
in `.env` or a command argument. The command refuses to create an initial admin
if one already exists.

Once HTTPS is configured, open `https://YOUR_PUBLIC_HOST/admin/` and sign in.
Use **Users** to create additional accounts or perform password resets. See
[administrator and login behavior](DEVELOPMENT.md#initial-administrator-and-browser-login)
for role and session details.

## 6. Prepare the archive-site publication checkout

Keep this checkout separate from the backend, with neither nested in the other:

```sh
cd ~/apps
git -c core.sshCommand="ssh -i $HOME/.ssh/archive_site_deploy -o IdentitiesOnly=yes -o BatchMode=yes" clone --branch main git@github.com:other-desert-radio/archive-site.git clean-archive-site
cd ~/apps/clean-archive-site
git config core.sshCommand "ssh -i $HOME/.ssh/archive_site_deploy -o IdentitiesOnly=yes -o BatchMode=yes"
git config user.name "Archive Publisher"
git config user.email "archive-publisher@users.noreply.github.com"
git ls-remote origin
git push --dry-run origin HEAD:main
```

The dry run checks the push path without updating the remote; an actual
publication can still be subject to branch rules. Use your preferred automation
commit identity if different.

For the future publication integration, the intended configuration is shown
below. These settings are not read by the application on `main`:

```dotenv
ARCHIVE_SITE_REPOSITORY=git@github.com:other-desert-radio/archive-site.git
ARCHIVE_CHECKOUT_PATH=../clean-archive-site
ARCHIVE_CONTAINER_CHECKOUT_PATH=/archive-site
ARCHIVE_PUBLISH_BRANCH=main
ARCHIVE_PUBLISH_ENABLED=false
```

The current Compose file does not mount this checkout or SSH credentials, pass
publication settings, or enable the runner. Future container integration must
provide Git/SSH tooling, the checkout, and read-only mounts for the dedicated
private key and verified `known_hosts`, readable by the runtime user. The host
`core.sshCommand` above contains a host path; configure an appropriate key path
inside the container when that integration is added. Do not bake keys into the
image. See [export behavior](ARCHIVE_EXPORT.md) for the existing standalone
export operation. Publication configuration and runner wiring belong to the
separate publication branch.

## Updates and backups

Before updating, back up the database using the
[existing backup and restore instructions](DEVELOPMENT.md#database-backups-and-restores).
Preserve `.env`, SSH keys, and the PostgreSQL volume. Fetch the intended
release, install its locked dependencies, review/apply migrations, rebuild with
`scripts/build-container`, and verify health and browser login again. Do not use
`docker compose down --volumes` for routine updates; it deletes database
storage.

## Troubleshooting session checks

The admin page calls `GET /api/auth/get-session` before showing sign-in. A JSON
`null` response with HTTP 200 means signed out and is normal. The error screen
means that request failed or returned an unreadable/unexpected response;
creating an administrator does not fix a transport or session-service failure.

Inspect the request in the browser's Network panel. Note the HTTP status,
content type, and `x-request-id` response header (also shown as a reference in
the error screen when available). Do not share cookies or session response
bodies; they can contain credentials or personal data.

Follow API logs while clicking **Retry**:

```sh
docker compose logs --follow --tail=100 api
```

`docker compose -f compose.yml logs --follow api` is the equivalent with an
explicit Compose file; `-f` on `docker compose` selects a file, while `--follow`
on `logs` follows output. Run against the same Compose project used to deploy.
Authentication logs include the endpoint, status, and reference for matching the
browser request.

Compare a direct local request with the public route (substitute your origin):

```sh
curl -i http://localhost:3000/api/auth/get-session
curl -i https://YOUR_PUBLIC_HOST/api/auth/get-session
```

Without cookies, both should normally return HTTP 200 with JSON `null`.

- **No API log for Retry, or HTML instead of JSON:** check that the proxy/tunnel
  routes `/api/` as well as `/admin/` to this API, and that the public hostname
  reaches the intended deployment. A static-site fallback can return HTML with
  HTTP 200. Compare direct and public responses before changing application
  code.
- **HTTP 502/503:** check API container health and proxy upstream host/port.
- **HTTP 500:** match the reference in authentication logs; check database
  connectivity, applied authentication migrations, and the runtime environment.
  `/health` alone does not prove the authentication schema is current.
- **HTTP 429:** wait a minute before retrying. Requests behind a proxy can share
  the current server-side rate-limit identity; do not repeatedly reload or
  disable rate limits to diagnose it.
- **Network failure:** check browser connectivity, TLS, DNS, and proxy
  reachability.

`BETTER_AUTH_URL` must be the public HTTPS origin, while the proxy's upstream
can use local HTTP on the configured API port. After changing `.env`, recreate
the API with `docker compose up -d --force-recreate api`; a plain restart does
not reload Compose environment values. If the browser still shows the old
generic error after deploying this change, check that the image was rebuilt and
the browser/proxy is serving the new admin bundle.
