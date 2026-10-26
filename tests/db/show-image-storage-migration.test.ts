import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { up as createShows } from "../../src/db/migrations/0002_create_shows_table.js";
import { up as addURLs } from "../../src/db/migrations/0023_add_show_image_urls.js";
import { up as dropLegacy } from "../../src/db/migrations/0024_drop_show_image.js";
import {
	up as renameURLs,
	down as undoRename,
} from "../../src/db/migrations/0036_rename_show_mixcloud_images.js";
import {
	up as addImages,
	down as dropImages,
} from "../../src/db/migrations/0037_add_show_webp_images.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.SHOW_MIGRATION_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"show image migrations preserve URLs and enforce paired nullable bytes through rollback/reapply",
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
			await sql`INSERT INTO shows (title, date, duration, image) VALUES ('Old show', '2026-10-01', 60, 'legacy')`.execute(
				db,
			);
			await addURLs(db);
			await sql`UPDATE shows SET image_small = 'small-url', image_large = 'large-url'`.execute(
				db,
			);
			await dropLegacy(db);
			await db.transaction().execute(renameURLs);
			const urls = {
				mixcloud_image_small: "small-url",
				mixcloud_image_large: "large-url",
			};
			expect(
				await db
					.selectFrom("shows")
					.select(["mixcloud_image_small", "mixcloud_image_large"])
					.executeTakeFirstOrThrow(),
			).toEqual(urls);
			await expect(
				sql`UPDATE shows SET mixcloud_image_small = NULL`.execute(db),
			).rejects.toThrow(/not-null/);
			await expect(
				sql`UPDATE shows SET mixcloud_image_large = NULL`.execute(db),
			).rejects.toThrow(/not-null/);
			await db.transaction().execute(addImages);
			expect(
				await db
					.selectFrom("shows")
					.select(["image_small", "image_large"])
					.executeTakeFirstOrThrow(),
			).toEqual({ image_small: null, image_large: null });
			const images = {
				image_small: Buffer.from("small"),
				image_large: Buffer.from("large"),
			};
			await expect(
				db
					.updateTable("shows")
					.set({ image_small: images.image_small })
					.execute(),
			).rejects.toThrow(/shows_webp_image_pair/);
			await expect(
				db
					.updateTable("shows")
					.set({ image_large: images.image_large })
					.execute(),
			).rejects.toThrow(/shows_webp_image_pair/);
			await db.updateTable("shows").set(images).execute();
			expect(
				await db
					.selectFrom("shows")
					.select(["image_small", "image_large"])
					.executeTakeFirstOrThrow(),
			).toEqual(images);
			await db
				.insertInto("shows")
				.values({
					title: "New show",
					date: new Date("2026-10-02"),
					duration: 60,
					url: "audio",
					...urls,
				})
				.execute();
			expect(
				await db
					.selectFrom("shows")
					.select(["image_small", "image_large"])
					.where("title", "=", "New show")
					.executeTakeFirstOrThrow(),
			).toEqual({ image_small: null, image_large: null });
			await db.transaction().execute(dropImages);
			await db.transaction().execute(undoRename);
			expect(
				(
					await sql`SELECT image_small, image_large FROM shows ORDER BY id`.execute(
						db,
					)
				).rows,
			).toEqual([
				{ image_small: "small-url", image_large: "large-url" },
				{ image_small: "small-url", image_large: "large-url" },
			]);
			await db.transaction().execute(renameURLs);
			await db.transaction().execute(addImages);
			expect(
				await db
					.selectFrom("shows")
					.select([
						"mixcloud_image_small",
						"mixcloud_image_large",
						"image_small",
						"image_large",
					])
					.execute(),
			).toEqual([
				{ ...urls, image_small: null, image_large: null },
				{ ...urls, image_small: null, image_large: null },
			]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
