import { expect, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import { adminRoutes } from "../../src/admin/admin.js";
import type { MixcloudIntegration } from "../../src/admin/routes/mixcloud/index.js";
import { recordUploadedShow } from "../../src/admin/routes/mixcloud/routes/upload/upload-store.js";
import { authOrigin } from "../../src/auth/auth.js";
import type { Database } from "../../src/db/types.js";
import { createMixcloudClient } from "../../src/mixcloud/index.js";

const cloudcast = {
	key: "/odr/show/",
	url: "https://www.mixcloud.com/odr/show/",
	name: "Provider title",
	tags: [
		{
			key: "/genres/house/",
			name: "House",
			url: "https://www.mixcloud.com/genres/house/",
		},
	],
	created_time: "2026-10-26T12:00:00Z",
	updated_time: "2026-10-26T12:00:00Z",
	play_count: 0,
	pictures: {
		large: "https://images.test/small.jpg",
		"1024wx1024h": "https://images.test/large.jpg",
	},
	slug: "show",
	audio_length: 120,
};

for (const [role, status] of [
	[undefined, 401],
	["user", 403],
	["editor", 403],
] as const)
	test(`upload review/save enforce session and origin boundaries (${role ?? "signed out"})`, async () => {
		const app = Fastify();
		await app.register(
			adminRoutes(
				{
					api: {
						getSession: async () =>
							role ? { user: { id: "actor", role } } : null,
					},
				} as never,
				{} as never,
			),
		);
		try {
			expect(
				(
					await app.inject({
						method: "DELETE",
						url: "/api/admin/mixcloud/uploads/1",
						headers: { origin: "https://foreign.test" },
					})
				).statusCode,
			).toBe(status);
			for (const action of ["prepare", "save"])
				expect(
					(
						await app.inject({
							method: "POST",
							url: `/api/admin/mixcloud/uploads/1/${action}`,
							headers: { origin: "https://foreign.test" },
							payload: {},
						})
					).statusCode,
				).toBe(status);
			if (role !== "editor")
				expect(
					(
						await app.inject({
							method: "GET",
							url: "/api/admin/mixcloud/uploads/pending",
						})
					).statusCode,
				).toBe(status);
		} finally {
			await app.close();
		}
	});

const databaseUrl = process.env.MIXCLOUD_UPLOADS_TEST_DATABASE_URL;
test.skipIf(!databaseUrl)(
	"prepare/save retain editorial data, serialize with imports, and roll back every write together",
	async () => {
		const schema = `upload_review_${crypto.randomUUID().replaceAll("-", "")}`;
		const db = new Kysely<Database>({
			dialect: new PostgresDialect({
				pool: new Pool({
					connectionString: databaseUrl,
					options: `-c search_path=${schema}`,
				}),
			}),
		});
		const logs: Record<string, unknown>[] = [];
		const app = Fastify({
			logger: {
				stream: {
					write: (line: string) => {
						logs.push(JSON.parse(line));
					},
				},
			},
		});
		let mode: "ok" | "timeout" | "malformed" | "http" = "ok";
		let providerCalls = 0;
		const integration: MixcloudIntegration = {
			client: createMixcloudClient(
				{
					clientId: "test",
					clientSecret: "test",
					redirectUri: `${authOrigin}/api/admin/mixcloud/callback`,
					tokenEncryptionKey: Buffer.alloc(32).toString("base64"),
				},
				{
					fetcher: async (url) => {
						providerCalls++;
						if (mode === "http")
							return Response.json(
								{ error: { message: "private-provider-message" } },
								{ status: 404 },
							);
						if (mode === "timeout")
							throw new DOMException(
								"private-provider-message",
								"TimeoutError",
							);
						return Response.json({
							...cloudcast,
							key: url.pathname,
							url: `https://www.mixcloud.com${url.pathname}`,
							...(mode === "malformed" ? { audio_length: 0 } : {}),
						});
					},
				},
			),
			store: {} as MixcloudIntegration["store"],
		};
		const reviewed = {
			title: " Reviewed title ",
			tags: ["Reviewed tag"],
			description: "Our description\r\nSecond line",
			date: "2026-10-25",
			djs: [1, 1],
		};
		const post = (id: number | string, action: string, payload: unknown = {}) =>
			app.inject({
				method: "POST",
				url: `/api/admin/mixcloud/uploads/${id}/${action}`,
				payload,
				headers: { origin: authOrigin },
			});
		const record = (key: string) =>
			recordUploadedShow(
				db,
				"actor",
				{
					title: "Original title",
					description: "Original description",
					date: "2026-10-26",
					djs: [1],
					mixcloud_title: "Provider title",
					tags: ["Requested tag"],
				},
				key,
			);
		const counts = async () =>
			Promise.all(
				["shows", "tags", "show_djs", "show_tags", "mixcloud_import"].map(
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
			await sql`CREATE TABLE "user" (id text PRIMARY KEY)`.execute(db);
			await sql`INSERT INTO "user" (id) VALUES ('actor')`.execute(db);
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
				"0022_add_mixcloud_parser_results",
				"0023_add_show_image_urls",
				"0024_drop_show_image",
				"0025_add_mixcloud_source_tags",
				"0029_add_archive_publication_state",
				"0035_unique_tag_titles",
				"0036_rename_show_mixcloud_images",
				"0037_add_show_webp_images",
				"0038_add_show_description",
				"0039_add_mixcloud_uploads",
			]) {
				const migration = await import(`../../src/db/migrations/${name}.js`);
				await db.transaction().execute(migration.up);
			}
			await db.insertInto("djs").values({ title: "DJ", bio: "bio" }).execute();
			await app.register(
				adminRoutes(
					{
						api: {
							getSession: async () => ({
								user: { id: "actor", role: "editor" },
							}),
						},
					} as never,
					db,
					undefined,
					integration,
				),
			);
			const upload = await record(cloudcast.key);
			const pending = () =>
				app.inject({
					method: "GET",
					url: "/api/admin/mixcloud/uploads/pending",
				});
			const pendingResponse = await pending();
			expect(pendingResponse.statusCode).toBe(200);
			expect(pendingResponse.headers["cache-control"]).toBe("no-store");
			expect(pendingResponse.json()).toEqual([
				{
					uploadId: upload.id,
					title: "Original title",
					date: "2026-10-26",
					key: cloudcast.key,
					url: cloudcast.url,
				},
			]);
			expect(providerCalls).toBe(0);
			const remove = (id: number | string) =>
				app.inject({
					method: "DELETE",
					url: `/api/admin/mixcloud/uploads/${id}`,
					headers: { origin: authOrigin },
				});
			for (const id of ["0", "1.5", "9007199254740992", "abc"])
				expect((await remove(id)).statusCode).toBe(400);
			expect((await remove(999)).statusCode).toBe(404);
			const removable = await record("/odr/remove-me/");
			expect(
				(await pending())
					.json()
					.map((item: { uploadId: number }) => item.uploadId),
			).toEqual([removable.id, upload.id]);
			expect((await remove(removable.id)).json()).toEqual({
				uploadId: removable.id,
			});
			expect((await pending()).json()).toHaveLength(1);
			expect((await remove(removable.id)).statusCode).toBe(404);
			expect(providerCalls).toBe(0);
			const unconfigured = Fastify({
				logger: {
					stream: {
						write: (line: string) => {
							logs.push(JSON.parse(line));
						},
					},
				},
			});
			try {
				await unconfigured.register(
					adminRoutes(
						{
							api: {
								getSession: async () => ({
									user: { id: "actor", role: "editor" },
								}),
							},
						} as never,
						db,
					),
				);
				const unavailable = await unconfigured.inject({
					method: "POST",
					url: `/api/admin/mixcloud/uploads/${upload.id}/prepare`,
					headers: { origin: authOrigin },
				});
				expect(unavailable.statusCode).toBe(503);
				expect(logs).toContainEqual(
					expect.objectContaining({
						uploadId: upload.id,
						statusCode: 503,
						reason: "integration_not_configured",
						elapsedMs: expect.any(Number),
						reqId: expect.any(String),
					}),
				);
			} finally {
				await unconfigured.close();
			}
			const revision = async () =>
				(
					await db
						.selectFrom("archive_publication_state")
						.select("revision")
						.executeTakeFirstOrThrow()
				).revision;
			const beforeReview = await revision();
			for (const id of ["0", "1.5", "9007199254740992", "abc"])
				for (const action of ["prepare", "save"])
					expect((await post(id, action, reviewed)).statusCode).toBe(400);
			expect((await post(999, "prepare")).statusCode).toBe(404);
			expect((await post(999, "save", reviewed)).statusCode).toBe(404);
			expect((await post(upload.id, "save", reviewed)).statusCode).toBe(409);
			mode = "timeout";
			expect((await post(upload.id, "prepare")).statusCode).toBe(504);
			mode = "malformed";
			expect((await post(upload.id, "prepare")).statusCode).toBe(502);
			expect((await pending()).json()).toHaveLength(1);
			mode = "http";
			expect((await post(upload.id, "prepare")).statusCode).toBe(502);
			expect(logs).toContainEqual(
				expect.objectContaining({
					uploadId: upload.id,
					statusCode: 502,
					providerStatus: 404,
					failureReason: "http_error",
					msg: "[Mixcloud Review] Mixcloud API returned HTTP 404",
					elapsedMs: expect.any(Number),
					reqId: expect.any(String),
				}),
			);
			expect(JSON.stringify(logs)).not.toContain("private-provider-message");
			mode = "ok";
			const prepared = await post(upload.id, "prepare");
			expect(prepared.statusCode).toBe(200);
			expect(logs).toContainEqual(
				expect.objectContaining({
					msg: "[Mixcloud Review] fetched provider metadata",
					requestedTitle: "Provider title",
					archiveTitle: "Original title",
					metadata: expect.objectContaining({
						name: cloudcast.name,
						tags: cloudcast.tags,
					}),
				}),
			);
			expect(prepared.json()).toMatchObject({
				uploadId: upload.id,
				editorial: {
					title: "Original title",
					description: "Original description",
					date: "2026-10-26",
					djs: [1],
				},
				mixcloud: cloudcast,
			});
			expect(
				(
					await db
						.selectFrom("mixcloud_uploads")
						.select("mixcloud_data")
						.where("id", "=", upload.id)
						.executeTakeFirstOrThrow()
				).mixcloud_data,
			).toEqual(cloudcast);
			expect(await revision()).toBe(beforeReview);
			const disabled = Fastify();
			try {
				await disabled.register(
					adminRoutes(
						{
							api: {
								getSession: async () => ({
									user: { id: "actor", role: "editor" },
								}),
							},
						} as never,
						db,
					),
				);
				expect(
					(
						await disabled.inject({
							method: "POST",
							url: `/api/admin/mixcloud/uploads/${upload.id}/prepare`,
							headers: { origin: authOrigin },
						})
					).statusCode,
				).toBe(503);
			} finally {
				await disabled.close();
			}
			await db
				.updateTable("mixcloud_uploads")
				.set({
					mixcloud_data: JSON.stringify({ ...cloudcast, key: "/wrong/show/" }),
				})
				.where("id", "=", upload.id)
				.execute();
			expect((await post(upload.id, "save", reviewed)).statusCode).toBe(409);
			await db
				.updateTable("mixcloud_uploads")
				.set({ mixcloud_data: JSON.stringify(cloudcast) })
				.where("id", "=", upload.id)
				.execute();
			for (const changes of [
				{ title: " " },
				{ date: "2026-02-30" },
				{ djs: [] },
				{ djs: [999] },
				{ description: "x".repeat(1001) },
				{ tags: [42] },
			])
				expect(
					(await post(upload.id, "save", { ...reviewed, ...changes }))
						.statusCode,
				).toBe(400);
			expect(await counts()).toEqual(["0", "0", "0", "0", "0"]);
			await sql`CREATE FUNCTION fail_upload_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.show_id IS NOT NULL THEN RAISE EXCEPTION 'forced link failure'; END IF; RETURN NEW; END; $$`.execute(
				db,
			);
			await sql`CREATE TRIGGER fail_upload_link BEFORE UPDATE ON mixcloud_uploads FOR EACH ROW EXECUTE FUNCTION fail_upload_link()`.execute(
				db,
			);
			expect((await post(upload.id, "save", reviewed)).statusCode).toBe(500);
			expect(await counts()).toEqual(["0", "0", "0", "0", "0"]);
			expect(await revision()).toBe(beforeReview);
			await sql`DROP TRIGGER fail_upload_link ON mixcloud_uploads`.execute(db);
			const callsBeforeSave = providerCalls;
			const responses = await Promise.all([
				post(upload.id, "save", {
					...reviewed,
					duration: 999,
					url: "https://fake.test/",
				}),
				post(upload.id, "save", reviewed),
			]);
			expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 201]);
			const saved = responses[0]?.json().show;
			expect(responses[1]?.json().show).toEqual(saved);
			expect(saved).toMatchObject({
				title: "Reviewed title",
				description: "<p>Our description<br />Second line</p>",
				date: "2026-10-25T00:00:00.000Z",
				djs: [1],
				duration: 120,
				url: cloudcast.url,
				mixcloud_image_small: cloudcast.pictures.large,
				mixcloud_image_large: cloudcast.pictures["1024wx1024h"],
			});
			expect(await counts()).toEqual(["1", "1", "1", "1", "1"]);
			expect(providerCalls).toBe(callsBeforeSave);
			expect(
				(await db.selectFrom("tags").select("title").executeTakeFirstOrThrow())
					.title,
			).toBe("Reviewed tag");
			expect(
				(
					await db
						.selectFrom("mixcloud_uploads")
						.select("show_id")
						.where("id", "=", upload.id)
						.executeTakeFirstOrThrow()
				).show_id,
			).toBe(saved.id);
			expect((await post(upload.id, "prepare")).statusCode).toBe(409);
			expect((await pending()).json()).toEqual([]);
			expect((await remove(upload.id)).statusCode).toBe(409);
			expect(
				(
					await post(upload.id, "save", {
						...reviewed,
						title: "Ignored",
						djs: [999],
					})
				).json().show,
			).toEqual(saved);
			// Existing edit callers omit description: it must survive unchanged.
			const edited = await app.inject({
				method: "POST",
				url: "/api/admin/modify-show",
				headers: { origin: authOrigin },
				payload: {
					id: saved.id,
					title: saved.title,
					date: "2026-10-25",
					djs: [1],
					duration: 120,
					url: cloudcast.url,
					mixcloud_image_small: cloudcast.pictures.large,
					mixcloud_image_large: cloudcast.pictures["1024wx1024h"],
					tags: ["House"],
				},
			});
			expect(edited.statusCode).toBe(200);
			expect(edited.json().description).toBe(saved.description);
			for (const description of [
				"Literal <script>bad()</script>\nSecond & line",
				"",
			]) {
				const response = await app.inject({
					method: "POST",
					url: "/api/admin/modify-show",
					headers: { origin: authOrigin },
					payload: {
						id: saved.id,
						title: saved.title,
						date: "2026-10-25",
						djs: [1],
						duration: 120,
						url: cloudcast.url,
						mixcloud_image_small: cloudcast.pictures.large,
						mixcloud_image_large: cloudcast.pictures["1024wx1024h"],
						tags: ["House"],
						description,
					},
				});
				expect(response.statusCode).toBe(200);
				const expected =
					description === ""
						? ""
						: "<p>Literal &lt;script&gt;bad()&lt;/script&gt;<br />Second &amp; line</p>";
				expect(response.json().description).toBe(expected);
				expect(
					(
						await db
							.selectFrom("shows")
							.select("description")
							.where("id", "=", saved.id)
							.executeTakeFirstOrThrow()
					).description,
				).toBe(expected);
			}

			// Race the existing import route against the upload save for one source row.
			const other = await record("/odr/other/");
			expect((await post(other.id, "prepare")).statusCode).toBe(200);
			const tracking = await db
				.insertInto("mixcloud_import")
				.values({ key: other.mixcloud_key })
				.returning("id")
				.executeTakeFirstOrThrow();
			const imported = app.inject({
				method: "POST",
				url: "/api/admin/create-show",
				headers: { origin: authOrigin },
				payload: {
					mixcloud_import_id: tracking.id,
					title: "Imported title",
					date: "2026-10-25",
					djs: [1],
					duration: 120,
					url: `https://www.mixcloud.com${other.mixcloud_key}`,
					mixcloud_image_small: cloudcast.pictures.large,
					mixcloud_image_large: cloudcast.pictures["1024wx1024h"],
					tags: ["House"],
				},
			});
			const [uploadResponse, importResponse] = await Promise.all([
				post(other.id, "save", reviewed),
				imported,
			]);
			expect(
				[uploadResponse.statusCode, importResponse.statusCode].sort(),
			).toEqual([200, 201]);
			expect(uploadResponse.json().show.id).toBe(importResponse.json().id);
			expect(await counts()).toEqual(["2", "2", "2", "2", "2"]);
		} finally {
			await app.close();
			await sql`DROP SCHEMA IF EXISTS ${sql.id(schema)} CASCADE`.execute(db);
			await db.destroy();
		}
	},
);
