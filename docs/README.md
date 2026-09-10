# Archive Backend Agent Notes

## Current status

This is a minimal TypeScript backend using Bun, Fastify, Kysely, and PostgreSQL.
The PostgreSQL database is intentionally empty. There are currently no migrations,
tables, or schema files.

## Commands

- `bun install` installs dependencies.
- `bun run dev` starts the server with Bun watch mode.
- `bun run start` starts the server once.
- `bun run typecheck` runs TypeScript validation.
- `bun run lint` runs Biome checks.
- `bun run setup-hooks` configures the tracked Git pre-commit hook.
- `scripts/build-container` rebuilds and starts the Docker Compose stack in the background.

## Conventions

- Keep the backend small until a concrete feature requires more structure.
- Use Kysely for database access; do not add migrations or tables until requested.
- Keep `.env` local and untracked. Update `.env.example` when required variables change.
- Update this document in the same change whenever the project behavior or workflow changes.
