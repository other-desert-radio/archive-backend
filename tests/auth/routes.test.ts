import { describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { authRoutes } from "../../src/auth/routes.js";

describe("Better Auth Fastify route", () => {
	test("forwards requests and responses through /api/auth", async () => {
		let receivedRequest: Request | undefined;
		const app = Fastify({ logger: false });
		await app.register(
			authRoutes({
				handler: async (request) => {
					receivedRequest = request;
					return new Response(JSON.stringify({ ok: true }), {
						status: 200,
						headers: { "content-type": "application/json" },
					});
				},
			}),
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/auth/sign-in/email",
			headers: {
				"content-type": "application/json",
				authorization: "Bearer test-token",
			},
			payload: { email: "admin@example.com", password: "password" },
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ ok: true });
		expect(receivedRequest?.method).toBe("POST");
		expect(receivedRequest?.url).toContain("/api/auth/sign-in/email");
		expect(receivedRequest?.headers.get("authorization")).toBe(
			"Bearer test-token",
		);
		expect(await receivedRequest?.json()).toEqual({
			email: "admin@example.com",
			password: "password",
		});

		await app.close();
	});

	test("forwards a failed sign-in response", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			authRoutes({
				handler: async () =>
					new Response(JSON.stringify({ error: "Invalid credentials" }), {
						status: 401,
						headers: { "content-type": "application/json" },
					}),
			}),
		);

		const response = await app.inject({
			method: "POST",
			url: "/api/auth/sign-in/email",
			payload: { email: "admin@example.com", password: "wrong-password" },
		});

		expect(response.statusCode).toBe(401);
		expect(response.json()).toEqual({ error: "Invalid credentials" });

		await app.close();
	});
});
