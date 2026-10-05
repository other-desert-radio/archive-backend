import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { down, up } from "../../src/db/migrations/0023_add_show_image_urls.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.SHOW_MIGRATION_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Show image URLs backfill, reject nulls atomically, and roll back without losing shows",
	async () => {
		const schema = `show_images_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`INSERT INTO shows (title, date, duration, image) VALUES
				('With image', '2026-01-01', 3600, 'https://example.test/image.jpg'),
				('Missing image', '2026-01-02', 1800, NULL)`.execute(db);
			const before = await db
				.selectFrom("shows")
				.selectAll()
				.orderBy("id")
				.execute();
			await expect(db.transaction().execute(up)).rejects.toThrow();
			expect(
				await db.selectFrom("shows").selectAll().orderBy("id").execute(),
			).toEqual(before);
			await sql`UPDATE shows SET image = 'https://example.test/fallback.jpg' WHERE image IS NULL`.execute(
				db,
			);
			const populated = await db
				.selectFrom("shows")
				.selectAll()
				.orderBy("id")
				.execute();
			await db.transaction().execute(up);
			const images = await sql<{
				image: string;
				image_large: string;
				image_small: string;
			}>`SELECT image, image_large, image_small FROM shows ORDER BY id`.execute(
				db,
			);
			expect(images.rows).toEqual(
				populated.map(({ image }) => ({
					image,
					image_large: image,
					image_small: image,
				})),
			);
			for (const column of ["image_large", "image_small"]) {
				await expect(
					sql`UPDATE shows SET ${sql.id(column)} = NULL`.execute(db),
				).rejects.toThrow();
			}
			await expect(
				sql`INSERT INTO shows (title, date, duration, image) VALUES ('New', '2026-01-03', 60, 'https://example.test/new.jpg')`.execute(
					db,
				),
			).rejects.toThrow();
			await db.transaction().execute(down);
			expect(
				await db.selectFrom("shows").selectAll().orderBy("id").execute(),
			).toEqual(populated);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
