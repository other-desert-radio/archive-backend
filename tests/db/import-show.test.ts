import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { adminRoutes } from "../../src/admin/admin.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.MIXCLOUD_IMPORT_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"import creation is atomic, serialized, validated, and repeatable",
	async () => {
		const schema = `import_show_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		const app = Fastify({ logger: false });
		const payload = {
			title: " Submitted ",
			date: "2026-10-01",
			duration: 123,
			url: "https://example.test/submitted",
			image_small: "https://example.test/small",
			image_large: "https://example.test/large",
			djs: [1, 1],
			tags: ["New", "new"],
			mixcloud_import_id: 1,
		};
		const post = (body: unknown) =>
			app.inject({
				method: "POST",
				url: "/api/admin/create-show",
				payload: body,
			});
		const counts = async () =>
			Promise.all(
				["shows", "tags", "show_djs", "show_tags"].map(
					async (table) =>
						(
							await sql<{
								count: string;
							}>`SELECT count(*) FROM ${sql.id(table)}`.execute(db)
						).rows[0]?.count,
				),
			);
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(db);
			for (const name of [
				"0001_create_djs_table",
				"0002_create_shows_table",
				"0003_create_tags_table",
				"0004_create_show_djs_table",
				"0005_create_show_tags_table",
				"0006_create_dj_tags_table",
				"0009_rename_tag_name_to_title",
				"0011_add_created_at_to_archive_tables",
				"0012_add_reviewed_to_tags",
				"0017_add_mixcloud_metadata_to_tags",
				"0018_create_mixcloud_import_table",
				"0019_add_mixcloud_source_metadata",
				"0021_add_mixcloud_data_changed",
				"0023_add_show_image_urls",
				"0024_drop_show_image",
			]) {
				const migration = await import(`../../src/db/migrations/${name}.js`);
				await migration.up(db);
			}
			await db.insertInto("djs").values({ title: "DJ", bio: "bio" }).execute();
			await db
				.insertInto("mixcloud_import")
				.values({
					key: "/source/",
					name: "Source",
					image_small: "source-small",
					image_large: "source-large",
					data_changed: true,
				})
				.execute();
			await app.register(
				adminRoutes(
					{
						api: {
							getSession: async () => ({
								user: { id: "admin", role: "admin" },
							}),
						},
					} as never,
					db,
				),
			);
			for (const changes of [
				{ mixcloud_import_id: 0 },
				{ mixcloud_import_id: 1.5 },
				{ mixcloud_import_id: Number.MAX_SAFE_INTEGER + 1 },
				{ mixcloud_import_id: "1" },
				{ mixcloud_import_id: null },
				{ djs: [999] },
				{ image_small: undefined },
				{ image_large: undefined },
				{ title: " " },
			]) {
				expect((await post({ ...payload, ...changes })).statusCode).toBe(400);
			}
			expect(
				(await post({ ...payload, mixcloud_import_id: 999 })).statusCode,
			).toBe(404);
			expect(await counts()).toEqual(["0", "0", "0", "0"]);
			await sql`CREATE FUNCTION fail_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced tracking failure'; END; $$`.execute(
				db,
			);
			await sql`CREATE TRIGGER fail_import BEFORE UPDATE ON mixcloud_import FOR EACH ROW EXECUTE FUNCTION fail_import()`.execute(
				db,
			);
			expect((await post(payload)).statusCode).toBe(500);
			expect(await counts()).toEqual(["0", "0", "0", "0"]);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.selectAll()
					.executeTakeFirstOrThrow(),
			).toMatchObject({ show_id: null, imported_at: null, data_changed: true });
			await sql`DROP TRIGGER fail_import ON mixcloud_import`.execute(db);
			const responses = await Promise.all([post(payload), post(payload)]);
			expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 201]);
			const saved = responses[0]?.json();
			expect(responses[1]?.json()).toEqual(saved);
			expect(saved).toMatchObject({
				title: "Submitted",
				url: payload.url,
				image: payload.image_large,
				image_small: payload.image_small,
				image_large: payload.image_large,
				duration: 123,
				date: "2026-10-01T00:00:00.000Z",
				djs: [1],
			});
			expect(await counts()).toEqual(["1", "1", "1", "1"]);
			const tracking = await db
				.selectFrom("mixcloud_import")
				.selectAll()
				.executeTakeFirstOrThrow();
			expect(tracking).toMatchObject({
				show_id: saved.id,
				data_changed: false,
			});
			expect(tracking.imported_at).toBeInstanceOf(Date);
			// Any attempted write makes this repeat request fail at the database boundary.
			for (const table of [
				"shows",
				"tags",
				"show_djs",
				"show_tags",
				"mixcloud_import",
			]) {
				await sql`CREATE TRIGGER reject_repeat_write BEFORE INSERT OR UPDATE OR DELETE ON ${sql.id(table)} FOR EACH STATEMENT EXECUTE FUNCTION fail_import()`.execute(
					db,
				);
			}
			const repeated = await post({
				...payload,
				title: "Ignored",
				tags: ["Ignored"],
				djs: [999],
			});
			expect(repeated.statusCode).toBe(200);
			expect(repeated.json()).toEqual(saved);
			expect(
				await db
					.selectFrom("mixcloud_import")
					.selectAll()
					.executeTakeFirstOrThrow(),
			).toEqual(tracking);
			expect(await counts()).toEqual(["1", "1", "1", "1"]);
		} finally {
			await app.close();
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
