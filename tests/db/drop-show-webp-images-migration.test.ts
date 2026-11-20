import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import {
	down,
	up,
} from "../../src/db/migrations/0049_drop_show_webp_images.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.SHOW_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"dropping Show image bytes preserves URLs and supports rollback/reapply",
	async () => {
		const schema = `drop_show_images_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`CREATE TABLE shows (id integer PRIMARY KEY, mixcloud_image_small text NOT NULL, mixcloud_image_large text NOT NULL, image_small bytea, image_large bytea, CONSTRAINT shows_webp_image_pair CHECK ((image_small IS NULL) = (image_large IS NULL)))`.execute(
				db,
			);
			await sql`INSERT INTO shows VALUES (1, 'small-url', 'large-url', 'small-bytes', 'large-bytes')`.execute(
				db,
			);
			await db.transaction().execute(up);
			expect((await sql`SELECT * FROM shows`.execute(db)).rows).toEqual([
				{
					id: 1,
					mixcloud_image_small: "small-url",
					mixcloud_image_large: "large-url",
				},
			]);
			await db.transaction().execute(down);
			expect(
				(await sql`SELECT image_small, image_large FROM shows`.execute(db))
					.rows,
			).toEqual([{ image_small: null, image_large: null }]);
			await expect(
				sql`UPDATE shows SET image_small = 'unpaired'`.execute(db),
			).rejects.toThrow(/shows_webp_image_pair/);
			await sql`UPDATE shows SET image_small = 'small', image_large = 'large'`.execute(
				db,
			);
			await db.transaction().execute(up);
			expect((await sql`SELECT * FROM shows`.execute(db)).rows).toEqual([
				{
					id: 1,
					mixcloud_image_small: "small-url",
					mixcloud_image_large: "large-url",
				},
			]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
