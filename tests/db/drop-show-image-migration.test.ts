import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as addImages } from "../../src/db/migrations/0023_add_show_image_urls.js";
import { down, up } from "../../src/db/migrations/0024_drop_show_image.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_IMPORT_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"dropping the legacy Show image preserves variants and rollback restores the large URL",
	async () => {
		const schema = `drop_image_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			await createShows(db);
			await sql`INSERT INTO shows (title, date, duration, image) VALUES ('Show', '2026-10-01', 60, 'legacy')`.execute(
				db,
			);
			await addImages(db);
			await sql`UPDATE shows SET image_small = 'small', image_large = 'large'`.execute(
				db,
			);
			const before = await db
				.selectFrom("shows")
				.select([
					"id",
					"title",
					"date",
					"duration",
					"url",
					"image_small",
					"image_large",
				])
				.execute();
			await db.transaction().execute(up);
			expect(await db.selectFrom("shows").selectAll().execute()).toEqual(
				before,
			);
			await expect(sql`SELECT image FROM shows`.execute(db)).rejects.toThrow();
			await db.transaction().execute(down);
			expect(
				(await sql<{ image: string }>`SELECT image FROM shows`.execute(db))
					.rows,
			).toEqual([{ image: "large" }]);
			expect(
				await db
					.selectFrom("shows")
					.select([
						"id",
						"title",
						"date",
						"duration",
						"url",
						"image_small",
						"image_large",
					])
					.execute(),
			).toEqual(before);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
