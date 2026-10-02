import { describe, expect, spyOn, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { adminRoutes } from "../../src/admin/admin.js";
import { mixcloudImportRoutes } from "../../src/admin/routes/mixcloud-imports/index.js";
import type { Database, MixcloudImportTable } from "../../src/db/types.js";

const timestamp = new Date("2026-09-01T12:00:00Z");
const emptyParserFields: Pick<
	MixcloudImportTable,
	| "derived_title"
	| "derived_date"
	| "decoded_djs"
	| "parser_version"
	| "parser_key"
	| "date_source"
> = {
	derived_title: null,
	derived_date: null,
	decoded_djs: null,
	parser_version: null,
	parser_key: null,
	date_source: null,
};
const rows = [
	{
		...emptyParserFields,
		id: 1,
		data_changed: true,
		mixcloud_tag_keys: ["/genres/ambient/", "/genres/experimental/"],
		key: "/odr/show/",
		url: "https://www.mixcloud.com/odr/show/",
		name: "Source show",
		created_time: timestamp,
		image_small: "https://example.test/small.jpg",
		image_large: "https://example.test/large.jpg",
		show_id: 10,
		imported_at: timestamp,
		show_name: "Show",
		duration: 3600,
		linked_djs: [
			{ id: 2, title: "DJ Two" },
			{ id: 9, title: "DJ Nine" },
		],
		linked_tags: [{ tag_id: 3 }, { tag_id: 5 }],
	},
	{
		...emptyParserFields,
		id: 2,
		data_changed: false,
		mixcloud_tag_keys: null,
		key: "/odr/pending/",
		url: null,
		name: null,
		created_time: null,
		image_small: null,
		image_large: null,
		show_id: null,
		imported_at: null,
		show_name: null,
		duration: null,
		linked_djs: [],
		linked_tags: [],
	},
];
// Compile and execute the actual Kysely query through a controlled PostgreSQL driver.
const database = (result: typeof rows, fail = false, queries: string[] = []) =>
	new Kysely<Database>({
		dialect: new PostgresDialect({
			pool: {
				connect: async () => ({
					query: async (sql: string) => {
						queries.push(sql);
						if (fail) throw new Error("offline");
						return { rows: result };
					},
					release: () => {},
				}),
				end: async () => {},
			} as never,
		}),
	});

describe("Mixcloud import list", () => {
	for (const dateSource of ["title", "created_time"] as const) {
		test(`returns stored parser suggestions with ${dateSource} date source`, async () => {
			const suggestions = {
				derived_title: "Extracted show",
				derived_date: timestamp,
				decoded_djs: ["Caroline", "Ethan"],
				parser_version: 1,
				parser_key: "common-comma-date",
				date_source: dateSource,
			};
			const queries: string[] = [];
			const db = database([{ ...rows[1], ...suggestions }], false, queries);
			const app = Fastify();
			try {
				await app.register(mixcloudImportRoutes(db));
				const response = await app.inject("/mixcloud-imports");
				expect(response.statusCode).toBe(200);
				expect(response.json()).toEqual([
					{
						id: 2,
						data_changed: false,
						key: "/odr/pending/",
						djs: [],
						dj_names: [],
						tags: [],
						...suggestions,
						derived_date: timestamp.toISOString(),
					},
				]);
				for (const field of Object.keys(suggestions)) {
					expect(queries[0]).toContain(`"mixcloud_import"."${field}"`);
				}
			} finally {
				await app.close();
				await db.destroy();
			}
		});
	}
	test("preserves partial parser results, empty DJ arrays, and scaffold version zero", async () => {
		const db = database([
			{
				...rows[1],
				derived_title: "Partial show",
				decoded_djs: [],
				parser_version: 0,
			},
		]);
		const app = Fastify();
		try {
			await app.register(mixcloudImportRoutes(db));
			const response = await app.inject("/mixcloud-imports");
			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual([
				{
					id: 2,
					data_changed: false,
					key: "/odr/pending/",
					djs: [],
					dj_names: [],
					tags: [],
					derived_title: "Partial show",
					decoded_djs: [],
					parser_version: 0,
				},
			]);
		} finally {
			await app.close();
			await db.destroy();
		}
	});
	test("logs fetch pages, save progress, and commit completion", async () => {
		const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
			Response.json({
				data: [
					{
						key: "/source/",
						url: "https://example.test/source",
						name: "Ethan - Side A, April 6, 2020",
						created_time: "2026-09-01T12:00:00Z",
						updated_time: "2026-09-01T12:00:00Z",
						play_count: 0,
						slug: "source",
						audio_length: 3600,
						pictures: { large: "small", "1024wx1024h": "large" },
						tags: [],
					},
				],
			}),
		);
		const logs: string[] = [];
		const db = database([]);
		const app = Fastify({
			logger: {
				stream: {
					write: (line: string) => {
						logs.push(JSON.parse(line).msg);
					},
				},
			},
		});
		try {
			await app.register(mixcloudImportRoutes(db));
			const response = await app.inject({
				method: "POST",
				url: "/refresh-mixcloud",
			});
			expect(response.statusCode).toBe(200);
			const messages = logs.join("\n");
			for (const text of [
				"fetching page 1",
				"page 1 response -- status: 200",
				"page 1 validated -- records: 1",
				"parsing completed -- 1/1 matched, 0 unmatched or excluded, parser version: 1",
				"saving started -- 1 cloudcasts",
				"saving progress -- 1/1",
				"completed -- committed 1 cloudcasts",
			])
				expect(messages).toContain(text);
		} finally {
			fetchMock.mockRestore();
			await app.close();
			await db.destroy();
		}
	});
	for (const invalidSource of [false, true]) {
		test(`refresh fails atomically on ${invalidSource ? "invalid source" : "database failure"}`, async () => {
			const source = {
				key: "/source/",
				url: "https://example.test/source",
				name: "Source",
				created_time: "2026-09-01T12:00:00Z",
				updated_time: "2026-09-01T12:00:00Z",
				play_count: 0,
				slug: "source",
				audio_length: 3600,
				pictures: { large: "small", "1024wx1024h": "large" },
				tags: [],
			};
			const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
				Response.json({
					data: [invalidSource ? { key: "/invalid/" } : source],
				}),
			);
			const queries: string[] = [];
			const db = database([], true, queries);
			const app = Fastify();
			try {
				await app.register(mixcloudImportRoutes(db));
				const response = await app.inject({
					method: "POST",
					url: "/refresh-mixcloud",
				});
				expect(response.statusCode).toBe(500);
				expect(response.json().error).toContain(
					invalidSource
						? "could not be fetched or validated"
						: "could not be saved",
				);
				expect(response.json().error).toContain("No changes were saved");
				expect(queries.length > 0).toBe(!invalidSource);
			} finally {
				fetchMock.mockRestore();
				await app.close();
				await db.destroy();
			}
		});
	}

	for (const role of [undefined, "user", "admin"] as const) {
		test(`refresh enforces admin access: ${role ?? "anonymous"}`, async () => {
			const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
				Response.json({ data: [] }),
			);
			const queries: string[] = [];
			const db = database([], true, queries);
			const app = Fastify();
			try {
				await app.register(
					adminRoutes(
						{
							api: {
								getSession: async () => (role ? { user: { role } } : null),
							},
						} as never,
						db,
						{ username: "", password: "" },
					),
				);
				const response = await app.inject({
					method: "POST",
					url: "/api/admin/refresh-mixcloud",
				});
				expect(response.statusCode).toBe(
					role === "admin" ? 200 : role === "user" ? 403 : 401,
				);
				expect(response.json()).toEqual(
					role === "admin"
						? { status: "ok" }
						: { error: role === "user" ? "Forbidden" : "Unauthorized" },
				);
				expect(queries).toEqual([]);
				expect(fetchMock).toHaveBeenCalledTimes(role === "admin" ? 1 : 0);
			} finally {
				fetchMock.mockRestore();
				await app.close();
				await db.destroy();
			}
		});
	}

	test("refresh returns a generic upstream failure without database access", async () => {
		const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("offline", { status: 503 }),
		);
		const queries: string[] = [];
		const db = database([], true, queries);
		const app = Fastify();
		try {
			await app.register(mixcloudImportRoutes(db));
			const response = await app.inject({
				method: "POST",
				url: "/refresh-mixcloud",
			});
			expect(response.statusCode).toBe(500);
			expect(response.json().error).toContain(
				"could not be fetched or validated",
			);
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(queries).toEqual([]);
		} finally {
			fetchMock.mockRestore();
			await app.close();
			await db.destroy();
		}
	});

	test("returns linked details and preserves unimported records using distinct correlated relationships", async () => {
		const queries: string[] = [];
		const db = database(rows, false, queries);
		const app = Fastify();
		try {
			await app.register(mixcloudImportRoutes(db));
			const response = await app.inject("/mixcloud-imports");
			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual([
				{
					id: 1,
					data_changed: true,
					mixcloud_tag_keys: rows[0].mixcloud_tag_keys,
					key: "/odr/show/",
					url: rows[0].url,
					name: rows[0].name,
					created_time: timestamp.toISOString(),
					image_small: rows[0].image_small,
					image_large: rows[0].image_large,
					show_id: 10,
					imported_at: timestamp.toISOString(),
					show_name: "Show",
					duration: 3600,
					djs: [2, 9],
					dj_names: ["DJ Two", "DJ Nine"],
					tags: [3, 5],
				},
				{
					id: 2,
					data_changed: false,
					key: "/odr/pending/",
					djs: [],
					dj_names: [],
					tags: [],
				},
			]);
			expect(queries[0]).toContain('"mixcloud_import"."duration"');
			expect(queries[0]).not.toContain('"shows"."duration"');
			expect(queries[0]).toContain('left join "shows"');
			expect(queries[0]).toContain('select distinct "djs"."id", "djs"."title"');
			expect(queries[0]).toContain('select distinct "tag_id"');
			expect(queries[0]).toContain(
				'"show_djs"."show_id" = "mixcloud_import"."show_id"',
			);
		} finally {
			await app.close();
			await db.destroy();
		}
	});
	test("returns source metadata for pending imports", async () => {
		const db = database([
			{
				...rows[0],
				show_id: null,
				imported_at: null,
				show_name: null,
				linked_djs: [],
				linked_tags: [],
			},
		]);
		const app = Fastify();
		try {
			await app.register(mixcloudImportRoutes(db));
			const response = await app.inject("/mixcloud-imports");
			expect(response.statusCode).toBe(200);
			expect(response.json()[0]).toEqual({
				id: 1,
				data_changed: true,
				mixcloud_tag_keys: rows[0].mixcloud_tag_keys,
				key: rows[0].key,
				url: rows[0].url,
				name: rows[0].name,
				created_time: timestamp.toISOString(),
				duration: 3600,
				image_small: rows[0].image_small,
				image_large: rows[0].image_large,
				djs: [],
				dj_names: [],
				tags: [],
			});
		} finally {
			await app.close();
			await db.destroy();
		}
	});
	test("returns an empty array", async () => {
		const db = database([]);
		const app = Fastify();
		try {
			await app.register(mixcloudImportRoutes(db));
			expect((await app.inject("/mixcloud-imports")).json()).toEqual([]);
		} finally {
			await app.close();
			await db.destroy();
		}
	});
	test("returns a generic database failure", async () => {
		const db = database([], true);
		const app = Fastify();
		try {
			await app.register(mixcloudImportRoutes(db));
			const response = await app.inject("/mixcloud-imports");
			expect(response.statusCode).toBe(500);
			expect(response.json()).toEqual({ error: "Internal Server Error" });
		} finally {
			await app.close();
			await db.destroy();
		}
	});
	test("requires admin access and accepts local Basic Auth", async () => {
		const db = database([]);
		const app = Fastify();
		try {
			await app.register(
				adminRoutes({ api: { getSession: async () => null } } as never, db, {
					username: "admin",
					password: "admin",
				}),
			);
			expect((await app.inject("/api/admin/mixcloud-imports")).statusCode).toBe(
				401,
			);
			expect(
				(
					await app.inject({
						url: "/api/admin/mixcloud-imports",
						headers: {
							authorization: `Basic ${Buffer.from("admin:admin").toString("base64")}`,
						},
					})
				).statusCode,
			).toBe(200);
		} finally {
			await app.close();
			await db.destroy();
		}
	});
	test("rejects non-admin sessions", async () => {
		const db = database([]);
		const app = Fastify();
		try {
			await app.register(
				adminRoutes(
					{
						api: { getSession: async () => ({ user: { role: "user" } }) },
					} as never,
					db,
				),
			);
			expect((await app.inject("/api/admin/mixcloud-imports")).statusCode).toBe(
				403,
			);
		} finally {
			await app.close();
			await db.destroy();
		}
	});
});
