import { afterEach, describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";
import { buildApp } from "../../src/app.js";

const localAdminToken = "test-admin-token";
process.env.ADMIN_LOCAL_TOKEN = localAdminToken;
const testAuth = {
	api: {
		getSession: async () => null,
	},
	handler: async () => new Response(null, { status: 404 }),
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

	test("rejects protected admin requests without a token", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes());
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

	test("allows the configured temporary token", async () => {
		const app = Fastify({ logger: false });
		await app.register(adminRoutes());
		apps.push(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin",
			headers: { authorization: `Bearer ${localAdminToken}` },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "admin api boundary ready" });
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
					getSession: async () => ({ user: { id: "admin-user" } }),
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

		expect(uiResponse.statusCode).toBe(501);
		expect(uiResponse.body).toContain("Admin UI is not implemented yet.");

		await app.close();
	});
});
