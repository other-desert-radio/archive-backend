# Other Desert Radio Backend

The database, backend, and admin UI for
[Other Desert Radio](https://otherdesertradio.com/)'s archive.

The Bun/Fastify backend stores archive data in PostgreSQL, serves a private
React/Vite management UI, and exports JSON and WebP assets for a separate Astro
static frontend.

See the [documentation index](docs/README.md) for task-specific references,
[development and operations](docs/DEVELOPMENT.md) for local setup, and the
[archive export contract](docs/ARCHIVE_EXPORT.md) for current filenames, JSON
fields, and frontend asset paths.
