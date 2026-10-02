import { describe, expect, spyOn, test } from "bun:test";
import Fastify from "fastify";
import { Kysely, PostgresDialect } from "kysely";
import { adminRoutes } from "../../src/admin/admin.js";
import { mixcloudImportRoutes } from "../../src/admin/routes/mixcloud-imports/index.js";
import type { Database } from "../../src/db/types.js";

const timestamp = new Date("2026-09-01T12:00:00Z");
const rows = [
	{
		id: 1,
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
		id: 2,
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
			expect(response.json()).toEqual({ error: "Internal Server Error" });
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
				{ id: 2, key: "/odr/pending/", djs: [], dj_names: [], tags: [] },
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
