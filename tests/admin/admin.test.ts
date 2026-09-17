import { afterEach, describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";
import { buildApp } from "../../src/app.js";

const testAuth = {
	api: {
		getSession: async () => null,
	},
	handler: async () => new Response(null, { status: 404 }),
} as never;

const adminSession = {
	api: {
		getSession: async () => ({
			user: { id: "admin-user", role: "admin" },
		}),
	},
} as never;

const testDatabase = {
	selectFrom: (table: string) => {
		const rows = {
			djs: [
				{
					id: 1,
					title: "DJ One",
					bio: "<p>Bio</p>",
					image: null,
					socials: "<p>@dj-one</p>",
				},
			],
			shows: [
				{
					id: 10,
					title: "Show One",
					date: new Date("2026-01-01T00:00:00.000Z"),
					duration: 3600,
					image: null,
					url: "https://example.com/show-one",
				},
			],
			show_djs: [{ dj_id: 1, show_id: 10 }],
			dj_tags: [{ dj_id: 1, tag_id: 20 }],
			show_tags: [{ dj_id: 1, tag_id: 21 }],
			tags: [{ title: "Dance" }, { title: "Techno" }],
		}[table as "djs" | "shows" | "tags" | "show_djs" | "dj_tags" | "show_tags"];
		let joined = false;

		type TestQuery = {
			select: () => TestQuery;
			innerJoin: () => TestQuery;
			orderBy: () => TestQuery;
			execute: () => Promise<unknown[]>;
		};

		const query: TestQuery = {
			select: () => query,
			innerJoin: () => {
				joined = true;
				return query;
			},
			orderBy: () => query,
			execute: async () => (joined ? [{ dj_id: 1, tag_id: 21 }] : (rows ?? [])),
		};

		return query;
	},
} as never;

const createTagsDatabase = {
	selectFrom: () => ({
		select: () => ({ execute: async () => [] }),
	}),
	insertInto: () => {
		let values: {
			title: string;
			color: string;
			reviewed: boolean;
		};
		let nextId = 1;
		const builder = {
			values: (input: typeof values) => {
				values = input;
				return builder;
			},
			returning: () => builder,
			executeTakeFirstOrThrow: async () => ({ id: nextId++, ...values }),
		};
		return builder;
	},
} as never;

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
	for (const app of apps.splice(0)) {
		await app.close();
	}
});

describe("admin route boundary", () => {
	test("keeps health public", async () => {
		const app = buildApp(testAuth);
		apps.push(app);

		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "ok" });
	});

	test("rejects protected admin requests without a session", async () => {
		const app = buildApp(testAuth);
		apps.push(app);

		const apiResponse = await app.inject({
			method: "GET",
			url: "/api/admin",
		});
		const uiResponse = await app.inject({ method: "GET", url: "/admin" });

		expect(apiResponse.statusCode).toBe(401);
		expect(apiResponse.json()).toEqual({ error: "Unauthorized" });
		expect(uiResponse.statusCode).toBe(401);
	});

	test("challenges for temporary browser-based Basic Auth", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes(testAuth, undefined, {
				username: "admin",
				password: "secret",
			}),
		);

		for (const url of ["/api/admin", "/admin"]) {
			const response = await app.inject({ method: "GET", url });

			expect(response.statusCode).toBe(401);
			expect(response.headers["www-authenticate"]).toBe(
				'Basic realm="Archive Admin", charset="UTF-8"',
			);

			const invalidResponse = await app.inject({
				method: "GET",
				url,
				headers: {
					authorization: `Basic ${Buffer.from("admin:wrong").toString("base64")}`,
				},
			});

			expect(invalidResponse.statusCode).toBe(401);
		}

		const authenticatedResponse = await app.inject({
			method: "GET",
			url: "/api/admin",
			headers: {
				authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
			},
		});

		expect(authenticatedResponse.statusCode).toBe(200);

		const authenticatedUiResponse = await app.inject({
			method: "GET",
			url: "/admin",
			headers: {
				authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
			},
		});

		expect(authenticatedUiResponse.statusCode).toBe(200);

		await app.close();
	});

	test("rejects admin requests without a Better Auth session", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes({
				api: {
					getSession: async () => null,
				},
			} as never),
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin",
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({ error: "Unauthorized" });

		const uiResponse = await app.inject({
			method: "GET",
			url: "/admin",
		});

		expect(uiResponse.statusCode).toBe(401);
		expect(uiResponse.json()).toEqual({ error: "Unauthorized" });

		await app.close();
	});

	test("allows admin requests with a Better Auth session", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes({
				api: {
					getSession: async () => ({
						user: { id: "admin-user", role: "admin" },
					}),
				},
			} as never),
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "admin api boundary ready" });

		const uiResponse = await app.inject({
			method: "GET",
			url: "/admin",
		});

		expect(uiResponse.statusCode).toBe(200);
		expect(uiResponse.body).toContain("Archive Admin");

		await app.close();
	});

	test("rejects an authenticated non-admin user", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes({
				api: {
					getSession: async () => ({
						user: { id: "regular-user", role: "user" },
					}),
				},
			} as never),
		);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin",
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: "Forbidden" });

		await app.close();
	});

	test("returns DJs with relationship IDs", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, testDatabase));

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/djs",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual([
			{
				id: 1,
				title: "DJ One",
				bio: "<p>Bio</p>",
				socials: "<p>@dj-one</p>",
				shows: [10],
				tags: [20, 21],
			},
		]);

		await app.close();
	});

	test("returns shows with relationship IDs", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, testDatabase));

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/shows",
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual([
			{
				id: 10,
				title: "Show One",
				date: "2026-01-01T00:00:00.000Z",
				duration: 3600,
				djs: [1],
				tags: [],
				url: "https://example.com/show-one",
			},
		]);

		await app.close();
	});

	test("returns a server error when shows cannot be loaded", async () => {
		const failingDatabase = {
			selectFrom: () => {
				throw new Error("database unavailable");
			},
		} as never;
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, failingDatabase));

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/shows",
		});

		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({ error: "Internal Server Error" });

		await app.close();
	});

	test("returns a server error when DJs cannot be loaded", async () => {
		const failingDatabase = {
			selectFrom: () => {
				throw new Error("database unavailable");
			},
		} as never;
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, failingDatabase));

		const response = await app.inject({
			method: "GET",
			url: "/api/admin/djs",
		});

		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({ error: "Internal Server Error" });

		await app.close();
	});

	test("validates tags for an authenticated admin", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, testDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: { tags: [" dance ", "new tag"] },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({
			valid: ["dance"],
			invalid: ["new tag"],
		});

		await app.close();
	});

	test("rejects an invalid tag-validation body", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, testDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: { tags: "dance" },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "invalid request body, expected array of strings",
		});

		await app.close();
	});

	test("returns a server error when tags cannot be loaded", async () => {
		const failingDatabase = {
			selectFrom: () => {
				throw new Error("database unavailable");
			},
		} as never;
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, failingDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: { tags: ["dance"] },
		});

		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({ error: "Internal Server Error" });

		await app.close();
	});

	test("protects tag validation from unauthenticated users", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(testAuth, testDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: { tags: ["dance"] },
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({ error: "Unauthorized" });

		await app.close();
	});

	test("protects tag validation from non-admin users", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			adminRoutes(
				{
					api: {
						getSession: async () => ({
							user: { id: "regular-user", role: "user" },
						}),
					},
				} as never,
				testDatabase,
			),
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/validate-tags",
			payload: { tags: ["dance"] },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: "Forbidden" });

		await app.close();
	});

	test("creates a DJ without tags", async () => {
		const createDatabase = {
			transaction: () => ({
				execute: async (callback: (transaction: never) => Promise<unknown>) =>
					callback({
						selectFrom: () => ({
							select: () => ({ execute: async () => [] }),
						}),
						insertInto: () => {
							const builder = {
								values: () => builder,
								returning: () => builder,
								executeTakeFirstOrThrow: async () => ({ id: 42 }),
								execute: async () => [],
							};
							return builder;
						},
					} as never),
			}),
		} as never;
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, createDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/create-dj",
			payload: {
				title: " DJ New ",
				bio: "First line\nSecond line",
				socials: " @dj-new ",
			},
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual({
			id: 42,
			title: "DJ New",
			bio: "<p>First line<br />Second line</p>",
			socials: "<p>@dj-new</p>",
			shows: [],
			tags: [],
		});

		await app.close();
	});

	test("rejects a structurally invalid DJ creation request", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, testDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/create-dj",
			payload: { title: "DJ New" },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ error: "Validation error" });

		await app.close();
	});

	test("rejects a DJ creation request with empty fields", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, testDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/create-dj",
			payload: { title: "", bio: "" },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "Validation error",
		});

		await app.close();
	});

	test("creates an autogenerated tag as unreviewed", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, createTagsDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/create-tag",
			payload: { title: "Dance" },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toMatchObject({
			title: "Dance",
			reviewed: false,
		});
		expect(response.json().color).toMatch(/^#[0-9a-f]{6}$/);

		await app.close();
	});

	test("creates an explicitly colored tag as reviewed", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, createTagsDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/create-tag",
			payload: { title: "Dance", color: "#ABC123" },
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toMatchObject({
			title: "Dance",
			color: "#ABC123",
			reviewed: true,
		});

		await app.close();
	});

	test("rejects a create-tag request with an invalid hex color", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, createTagsDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/create-tag",
			payload: { title: "Dance", color: "magenta" },
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ error: "Validation error" });

		await app.close();
	});

	test("creates a batch of tags", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes(adminSession, createTagsDatabase));

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/create-tags",
			payload: [{ title: "Dance" }, { title: "House", color: "#123456" }],
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual([
			expect.objectContaining({ title: "Dance", reviewed: false }),
			expect.objectContaining({
				title: "House",
				color: "#123456",
				reviewed: true,
			}),
		]);

		await app.close();
	});
});
