import { expect, test } from "bun:test";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { recordUploadedShow } from "../../src/admin/routes/mixcloud/routes/upload/upload-store.js";
import { down, up } from "../../src/db/migrations/0039_add_mixcloud_uploads.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_UPLOADS_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"upload migration and storage preserve editorial data, enforce identity, and rollback/reapply",
	async () => {
		const schema = `uploads_${crypto.randomUUID().replaceAll("-", "")}`;
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
			await sql`CREATE TABLE "user" (id text PRIMARY KEY)`.execute(db);
			await sql`CREATE TABLE shows (id integer PRIMARY KEY)`.execute(db);
			await sql`INSERT INTO "user" (id) VALUES ('uploader')`.execute(db);
			await sql`INSERT INTO shows (id) VALUES (10)`.execute(db);
			await db.transaction().execute(up);
			const draft = {
				title: "Our show",
				description: "Our description\nSecond paragraph",
				date: "2026-10-26",
				djs: [1, 2],
				mixcloud_title: "DJs - Our show",
				tags: ["House"],
			};
			const saved = await recordUploadedShow(
				db,
				"uploader",
				draft,
				"/odr/show/",
			);
			expect(saved).toMatchObject({
				...draft,
				date: new Date("2026-10-26T00:00:00.000Z"),
				created_by: "uploader",
				mixcloud_key: "/odr/show/",
				mixcloud_data: null,
				show_id: null,
			});
			expect(saved.id).toBeGreaterThan(0);
			expect(saved.createdAt).toBeInstanceOf(Date);
			await expect(
				recordUploadedShow(db, "uploader", draft, "/odr/show/"),
			).rejects.toThrow(/unique/);
			await expect(
				recordUploadedShow(db, "missing-user", draft, "/odr/other/"),
			).rejects.toThrow(/foreign key/);
			const { description: _description, ...withoutDescription } = draft;
			expect(
				(
					await recordUploadedShow(
						db,
						"uploader",
						withoutDescription,
						"/odr/other/",
					)
				).description,
			).toBeNull();
			await db
				.updateTable("mixcloud_uploads")
				.set({ show_id: 10 })
				.where("id", "=", saved.id)
				.execute();
			await sql`DELETE FROM shows WHERE id = 10`.execute(db);
			await sql`DELETE FROM "user" WHERE id = 'uploader'`.execute(db);
			expect(
				await db
					.selectFrom("mixcloud_uploads")
					.select(["created_by", "show_id"])
					.where("id", "=", saved.id)
					.executeTakeFirstOrThrow(),
			).toEqual({ created_by: null, show_id: null });
			await db.transaction().execute(down);
			await db.transaction().execute(up);
			expect(
				await db.selectFrom("mixcloud_uploads").selectAll().execute(),
			).toEqual([]);
		} finally {
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
