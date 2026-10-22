import { afterEach, expect, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";
import type { MixcloudIntegration } from "../../src/admin/routes/mixcloud/index.js";
import { auth, authOrigin } from "../../src/auth/auth.js";
import { db } from "../../src/db/db.js";
import {
	createMixcloudClient,
	type MixcloudIdentity,
} from "../../src/mixcloud/index.js";

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
	await Promise.all(apps.map((app) => app.close()));
	apps.length = 0;
});

const setup = async ({
	role = "editor",
	configured = true,
	fail = false,
	connected = false,
	passwordChange = false,
}: {
	role?: string;
	configured?: boolean;
	fail?: boolean;
	connected?: boolean;
	passwordChange?: boolean;
} = {}) => {
	const calls: {
		owners: { userId: string; sessionId: string }[];
		reads: string[];
	} = { owners: [], reads: [] };
	const logs: string[] = [];
	const account: MixcloudIdentity = {
		key: "/station/",
		displayName: "Station",
	};
	const integration: MixcloudIntegration = {
		client: createMixcloudClient({
			clientId: "app-id",
			clientSecret: "private-client-secret",
			redirectUri: `${authOrigin}/api/admin/mixcloud/callback`,
			tokenEncryptionKey: Buffer.alloc(32).toString("base64"),
		}),
		store: {
			getConnection: async (userId) => {
				calls.reads.push(userId);
				if (fail) throw new Error("private-database-error");
				return connected ? account : undefined;
			},
			createAttempt: async (owner) => {
				calls.owners.push(owner);
				if (fail) throw new Error("private-state private-database-error");
				return "private-state";
			},
			getAccessToken: async () => {
				throw new Error("Unexpected token read");
			},
			completeAuthorization: async () => {
				throw new Error("Unexpected completion");
			},
			disconnect: async () => {
				throw new Error("Unexpected disconnect");
			},
		},
	};
	const now = new Date();
	const authentication = {
		...auth,
		api: {
			...auth.api,
			getSession: async () =>
				role === "anonymous"
					? null
					: {
							user: {
								id: "actor",
								name: "Actor",
								email: "actor@example.test",
								emailVerified: true,
								image: null,
								role,
								mustChangePassword: passwordChange,
								banned: false,
								banReason: null,
								banExpires: null,
								createdAt: now,
								updatedAt: now,
							},
							session: {
								id: "archive-session",
								userId: "actor",
								token: "private-archive-token",
								expiresAt: new Date(Date.now() + 60_000),
								createdAt: now,
								updatedAt: now,
								ipAddress: null,
								userAgent: null,
								impersonatedBy: null,
							},
						},
		},
	};
	const app = Fastify({
		logger: {
			stream: {
				write: (line: string) => {
					logs.push(line);
				},
			},
		},
		disableRequestLogging: true,
	});
	apps.push(app);
	await app.register(
		adminRoutes(
			authentication,
			db,
			undefined,
			configured ? integration : undefined,
		),
	);
	return { app, calls, logs };
};

test("connect uses authenticated owner/session and returns the consent URL without secrets", async () => {
	for (const role of ["admin", "editor"]) {
		const { app, calls, logs } = await setup({ role });
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/mixcloud/connect",
			headers: { origin: authOrigin, cookie: "archive=session" },
			payload: { userId: "attacker", sessionId: "attacker" },
		});
		expect(response.statusCode).toBe(200);
		expect(calls.owners).toEqual([
			{ userId: "actor", sessionId: "archive-session" },
		]);
		const url = new URL(response.json().authorizationUrl);
		expect(url.origin).toBe("https://www.mixcloud.com");
		expect(url.searchParams.get("state")).toBe("private-state");
		expect(url.searchParams.get("client_id")).toBe("app-id");
		expect(response.body).not.toContain("private-client-secret");
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(logs.join("")).not.toContain("private-state");
	}
});

test("status reports disabled, disconnected and connected states without token reads", async () => {
	for (const [options, expected] of [
		[{ configured: false }, { configured: false, connected: false }],
		[{}, { configured: true, connected: false }],
		[
			{ connected: true },
			{
				configured: true,
				connected: true,
				account: { key: "/station/", displayName: "Station" },
			},
		],
	] as const) {
		const { app, calls } = await setup(options);
		const response = await app.inject("/api/admin/mixcloud/status");
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual(expected);
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(calls.reads).toEqual(options.configured === false ? [] : ["actor"]);
	}
});

test("disabled connect returns 503 without creating an attempt", async () => {
	const { app, calls } = await setup({ configured: false });
	const response = await app.inject({
		method: "POST",
		url: "/api/admin/mixcloud/connect",
		headers: { origin: authOrigin },
	});
	expect(response.statusCode).toBe(503);
	expect(calls.owners).toHaveLength(0);
});

test("shared boundary rejects anonymous, forbidden and password-change sessions", async () => {
	for (const [options, status] of [
		[{ role: "anonymous" }, 401],
		[{ role: "viewer" }, 403],
		[{ passwordChange: true }, 403],
	] as const) {
		const { app, calls } = await setup(options);
		for (const [method, url] of [
			["GET", "/api/admin/mixcloud/status"],
			["POST", "/api/admin/mixcloud/connect"],
		] as const) {
			const response = await app.inject({
				method,
				url,
				headers: { origin: authOrigin },
			});
			expect(response.statusCode).toBe(status);
		}
		expect(calls.owners).toHaveLength(0);
		expect(calls.reads).toHaveLength(0);
	}
});

test("connect rejects foreign or missing browser origins", async () => {
	const { app, calls } = await setup();
	for (const headers of [
		{ cookie: "archive=session", origin: "https://attacker.example" },
		{ cookie: "archive=session" },
	]) {
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/mixcloud/connect",
			headers,
		});
		expect(response.statusCode).toBe(403);
	}
	expect(calls.owners).toHaveLength(0);
});

test("storage failures return safe errors and keep raw exceptions out of parent logs", async () => {
	const { app, logs } = await setup({ fail: true });
	for (const [method, url] of [
		["GET", "/api/admin/mixcloud/status"],
		["POST", "/api/admin/mixcloud/connect"],
	] as const) {
		const response = await app.inject({
			method,
			url,
			headers: { origin: authOrigin },
		});
		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({
			error: "Unable to access Mixcloud connection",
		});
	}
	expect(logs.join("")).not.toContain("private-database-error");
	expect(logs.join("")).not.toContain("private-state");
});
