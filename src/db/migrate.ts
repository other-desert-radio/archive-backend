import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { db } from "./db.js";

const migrationFolder = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"migrations",
);

const migrator = new Migrator({
	db,
	provider: new FileMigrationProvider({
		fs,
		path,
		migrationFolder,
	}),
});

const direction = process.argv[2] ?? "up";

try {
	if (direction !== "up" && direction !== "down") {
		throw new Error("Usage: bun src/db/migrate.ts [up|down]");
	}

	const result =
		direction === "up"
			? await migrator.migrateUp()
			: await migrator.migrateDown();

	if (result.error) {
		throw result.error;
	}

	for (const migration of result.results ?? []) {
		console.log(`${migration.status}: ${migration.migrationName}`);
	}
} catch (error: unknown) {
	console.error(error);
	process.exitCode = 1;
} finally {
	await db.destroy();
}
