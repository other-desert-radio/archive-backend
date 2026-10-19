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

describe("authentication transport security", () => {
	test("blocks alternate library mutations before reaching Better Auth", async () => {
		let calls = 0;
		const app = Fastify({ logger: false });
		await app.register(
			authRoutes({
				handler: async () => {
					calls++;
					return new Response("{}");
				},
			}),
		);
		for (const endpoint of [
			"admin/create-user",
			"admin/set-role",
			"admin/set-user-password",
			"change-password",
			"update-user",
			"delete-user",
			"sign-up/email",
			"reset-password",
			"request-password-reset",
			"set-password",
		]) {
			const response = await app.inject({
				method: "POST",
				url: `/api/auth/${endpoint}`,
				payload: {},
			});
			expect(response.statusCode).toBe(404);
		}
		expect(calls).toBe(0);
		await app.close();
	});
	test("preserves separate cookies, canonical URL and trusted source IP", async () => {
		let received: Request | undefined;
		const app = Fastify({ logger: false });
		await app.register(
			authRoutes({
				handler: async (request) => {
					received = request;
					const headers = new Headers({ "content-type": "application/json" });
					headers.append("set-cookie", "one=1; Path=/; HttpOnly");
					headers.append("set-cookie", "two=2; Path=/; HttpOnly");
					return new Response("{}", { headers });
				},
			}),
		);
		const response = await app.inject({
			method: "POST",
			url: "/api/auth/sign-in/email",
			headers: {
				host: "attacker.example",
				"x-forwarded-proto": "https",
				"x-forwarded-for": "1.2.3.4",
				"x-archive-client-ip": "1.2.3.4",
			},
			payload: {},
		});
		expect(response.statusCode).toBe(200);
		expect(response.headers["set-cookie"]).toEqual([
			"one=1; Path=/; HttpOnly",
			"two=2; Path=/; HttpOnly",
		]);
		expect(received?.headers.get("x-forwarded-for")).toBeNull();
		expect(received?.headers.get("x-archive-client-ip")).toBe("127.0.0.1");
		expect(received?.url).not.toContain("attacker.example");
		await app.close();
	});
	test("rejects cross-origin and missing-origin cookie writes", async () => {
		const app = Fastify({ logger: false });
		await app.register(
			authRoutes({
				handler: async () =>
					new Response("{}", {
						headers: { "content-type": "application/json" },
					}),
			}),
		);
		for (const headers of [
			{ origin: "https://attacker.example" },
			{ cookie: "session=stolen" },
		]) {
			const response = await app.inject({
				method: "POST",
				url: "/api/auth/sign-out",
				headers,
				payload: {},
			});
			expect(response.statusCode).toBe(403);
		}
		await app.close();
	});
});
