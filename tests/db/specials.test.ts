import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import { Kysely, PostgresDialect, sql } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { Pool } from "pg";
import { adminRoutes } from "../../src/admin/admin.js";
import { loadSavedShow } from "../../src/admin/routes/shows/save-show.js";
import { allocateArchiveVersions } from "../../src/db/archive-versions.js";
import {
	loadArchiveDocuments,
	writeArchiveDocuments,
} from "../../src/db/export-archive.js";
import { down, up } from "../../src/db/migrations/0046_add_specials.js";
import { down as removeUploadSpecial } from "../../src/db/migrations/0047_add_upload_special.js";
import type { Database } from "../../src/db/types.js";

const databaseUrl = process.env.SPECIALS_TEST_DATABASE_URL;

test.skipIf(!databaseUrl)(
	"Specials migrate, save through the API, export, and version independently",
	async () => {
		const schema = `specials_${crypto.randomUUID().replaceAll("-", "")}`;
		const database = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		const app = Fastify({ logger: false });
		const output = await fs.mkdtemp("/tmp/specials-export-");
		try {
			await sql`CREATE SCHEMA ${sql.id(schema)}`.execute(database);
			const migrator = new Migrator({
				db: database,
				migrationTableSchema: schema,
				provider: new FileMigrationProvider({
					fs,
					path,
					migrationFolder: path.resolve("src/db/migrations"),
				}),
			});
			const migration = await migrator.migrateToLatest();
			if (migration.error) throw migration.error;
			await app.register(
				adminRoutes(
					{
						api: {
							getSession: async () => ({
								user: { id: "admin", role: "admin" },
							}),
						},
					} as never,
					database,
				),
			);
			const special = await database
				.insertInto("specials")
				.values({
					title: "Winter Sessions",
					createdAt: new Date("2026-11-16T00:00:00Z"),
				})
				.returningAll()
				.executeTakeFirstOrThrow();
			const empty = await database
				.insertInto("specials")
				.values({ title: "Empty Special" })
				.returningAll()
				.executeTakeFirstOrThrow();
			const dj = await database
				.insertInto("djs")
				.values({ title: "DJ" })
				.returning("id")
				.executeTakeFirstOrThrow();
			const payload = {
				title: "Special Show",
				date: "2026-11-16",
				duration: 60,
				url: "https://example.test/show",
				mixcloud_image_small: "https://example.test/small",
				mixcloud_image_large: "https://example.test/large",
				djs: [] as number[],
				tags: [],
			};
			const save = (body: object, id?: number) =>
				app.inject({
					method: "POST",
					url:
						id === undefined
							? "/api/admin/create-show"
							: "/api/admin/modify-show",
					payload: { ...payload, ...body, ...(id === undefined ? {} : { id }) },
				});
			expect((await save({})).statusCode).toBe(400);
			expect((await save({ special_id: 99999 })).statusCode).toBe(400);
			for (const special_id of [0, -1, 1.5, "1", false])
				expect((await save({ special_id })).statusCode).toBe(400);
			expect(await database.selectFrom("shows").selectAll().execute()).toEqual(
				[],
			);
			const created = await save({ special_id: special.id });
			expect(created.statusCode).toBe(201);
			expect(created.json()).toMatchObject({
				special: { id: special.id, title: special.title },
				djs: [],
			});
			const id = created.json().id as number;
			expect((await save({ title: "Renamed" }, id)).json().special.id).toBe(
				special.id,
			);
			expect((await save({ special_id: null }, id)).statusCode).toBe(400);
			expect((await save({ special_id: 99999 }, id)).statusCode).toBe(400);
			expect(
				(await save({ special_id: special.id, djs: [dj.id] }, id)).json(),
			).toMatchObject({ special: { id: special.id }, djs: [dj.id] });
			expect(
				(await save({ special_id: null, djs: [dj.id] }, id)).json().special,
			).toBeUndefined();
			expect((await save({ special_id: special.id }, id)).statusCode).toBe(200);
			const list = await app.inject({ method: "GET", url: "/api/admin/shows" });
			expect(list.statusCode).toBe(200);
			expect(list.json()[0]).toMatchObject({
				special: { id: special.id, title: special.title },
				djs: [],
			});
			const loaded = await database
				.transaction()
				.execute((trx) => loadSavedShow(trx, id));
			expect(loaded.special).toEqual({ id: special.id, title: special.title });
			const allocate = () =>
				allocateArchiveVersions(database, async (trx) => ({
					documents: await loadArchiveDocuments(trx, { log: () => {} }),
				}));
			const first = await allocate();
			expect(first.documents.specials).toEqual([
				{
					id: special.id,
					title: special.title,
					createdAt: special.createdAt.toISOString(),
					showIds: [id],
				},
				{
					id: empty.id,
					title: empty.title,
					createdAt: empty.createdAt.toISOString(),
					showIds: [],
				},
			]);
			expect(first.versions.specials.id).toBe(1);
			expect((await allocate()).versions).toEqual(first.versions);
			await writeArchiveDocuments(
				first.documents,
				path.join(output, "resources"),
				path.join(output, "assets"),
				{ log: () => {} },
				first.versions,
			);
			expect(
				JSON.parse(
					await fs.readFile(
						path.join(output, "resources/specials.json"),
						"utf8",
					),
				),
			).toEqual({
				version: 1,
				updatedAt: first.versions.specials.updatedAt,
				data: first.documents.specials,
			});
			const revision = await database
				.selectFrom("archive_publication_state")
				.select("revision")
				.executeTakeFirstOrThrow();
			await database
				.updateTable("specials")
				.set({ title: "Renamed Special" })
				.where("id", "=", special.id)
				.execute();
			expect(
				BigInt(
					(
						await database
							.selectFrom("archive_publication_state")
							.select("revision")
							.executeTakeFirstOrThrow()
					).revision,
				),
			).toBeGreaterThan(BigInt(revision.revision));
			const renamed = await allocate();
			expect(renamed.versions).toEqual({
				...first.versions,
				specials: { id: 2, updatedAt: expect.any(String) },
			});
			await expect(
				database.deleteFrom("specials").where("id", "=", special.id).execute(),
			).rejects.toThrow();
			await expect(
				database.insertInto("specials").values({ title: " \t\n" }).execute(),
			).rejects.toThrow();
			await expect(
				database
					.updateTable("shows")
					.set({ special_id: 99999 })
					.where("id", "=", id)
					.execute(),
			).rejects.toThrow();
			await save({ special_id: empty.id }, id);
			const reassigned = await allocate();
			expect(reassigned.versions.specials.id).toBe(3);
			expect(reassigned.versions.shows).toEqual(first.versions.shows);
			await database.transaction().execute(removeUploadSpecial);
			await database.transaction().execute(down);
			expect(
				(await sql`SELECT * FROM shows`.execute(database)).rows,
			).toHaveLength(1);
			expect(
				await database
					.selectFrom("archive_dataset_versions")
					.selectAll()
					.where("dataset", "=", "specials")
					.execute(),
			).toEqual([]);
			await database.transaction().execute(up);
			expect(
				await database.selectFrom("specials").selectAll().execute(),
			).toEqual([]);
			expect(
				(
					await database
						.selectFrom("shows")
						.select("special_id")
						.executeTakeFirstOrThrow()
				).special_id,
			).toBeNull();
		} finally {
			await app.close();
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(
				database,
			);
			await database.destroy();
			await fs.rm(output, { recursive: true, force: true });
		}
	},
	30000,
);
