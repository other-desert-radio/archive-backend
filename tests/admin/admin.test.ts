import { afterEach, describe, expect, test } from "bun:test";
import { buildApp } from "../../src/app.js";

const localAdminToken = "test-admin-token";
process.env.ADMIN_LOCAL_TOKEN = localAdminToken;

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
	for (const app of apps.splice(0)) {
		await app.close();
	}
});

describe("admin route boundary", () => {
	test("keeps health public", async () => {
		const app = buildApp();
		apps.push(app);

		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "ok" });
	});

	test("rejects protected admin requests without a token", async () => {
		const app = buildApp();
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
		const app = buildApp();
		apps.push(app);

		const response = await app.inject({
			method: "GET",
			url: "/api/admin",
			headers: { authorization: `Bearer ${localAdminToken}` },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "admin api boundary ready" });
	});
});
