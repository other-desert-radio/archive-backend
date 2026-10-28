import { afterEach, expect, spyOn, test } from "bun:test";
import Fastify from "fastify";
import { adminRoutes } from "../../src/admin/admin.js";
import type { MixcloudIntegration } from "../../src/admin/routes/mixcloud/index.js";
import { buildApp } from "../../src/app.js";
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
	providerFail = false,
	identityFail = false,
}: {
	role?: string;
	configured?: boolean;
	fail?: boolean;
	connected?: boolean;
	passwordChange?: boolean;
	providerFail?: boolean;
	identityFail?: boolean;
} = {}) => {
	const calls: {
		owners: { userId: string; sessionId: string }[];
		reads: string[];
		completions: { userId: string; sessionId: string; state: string }[];
		disconnected: string[];
		provider: string[];
	} = {
		owners: [],
		reads: [],
		completions: [],
		disconnected: [],
		provider: [],
	};
	const logs: string[] = [];
	const account: MixcloudIdentity = {
		key: "/station/",
		displayName: "Station",
	};
	let currentAccount = connected ? account : undefined;
	const pending = new Set<string>();
	const integration: MixcloudIntegration = {
		client: createMixcloudClient(
			{
				clientId: "app-id",
				clientSecret: "private-client-secret",
				redirectUri: `${authOrigin}/api/admin/mixcloud/callback`,
				tokenEncryptionKey: Buffer.alloc(32).toString("base64"),
			},
			{
				fetcher: async (url) => {
					calls.provider.push(url.pathname);
					if (providerFail)
						throw new Error("private-provider-error private-token");
					if (url.pathname === "/oauth/access_token")
						return new Response("access_token=private-token");
					if (identityFail)
						return new Response("private-token", { status: 500 });
					return Response.json({ key: account.key, name: account.displayName });
				},
			},
		),
		store: {
			getConnection: async (userId) => {
				calls.reads.push(userId);
				if (fail) throw new Error("private-database-error");
				return currentAccount;
			},
			createAttempt: async (owner) => {
				calls.owners.push(owner);
				if (fail) throw new Error("private-state private-database-error");
				pending.add("private-state");
				return "private-state";
			},
			getAccessToken: async () => {
				throw new Error("Unexpected token read");
			},
			completeAuthorization: async (owner, state, authorize) => {
				calls.completions.push({ ...owner, state });
				if (fail) throw new Error("private-database-error private-state");
				if (
					owner.userId !== "actor" ||
					owner.sessionId !== "archive-session" ||
					!pending.delete(state)
				)
					return false;
				const connection = await authorize();
				currentAccount = connection.identity;
				return true;
			},
			disconnect: async (userId) => {
				calls.disconnected.push(userId);
				if (fail) throw new Error("private-database-error private-token");
				currentAccount = undefined;
				pending.clear();
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
	return { app, calls, logs, authentication, integration };
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
			[
				"GET",
				"/api/admin/mixcloud/callback?state=private-state&code=private-code",
			],
			["POST", "/api/admin/mixcloud/disconnect"],
			["POST", "/api/admin/mixcloud/upload"],
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
		expect(calls.completions).toHaveLength(0);
		expect(calls.disconnected).toHaveLength(0);
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
		["POST", "/api/admin/mixcloud/disconnect"],
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

const begin = (app: ReturnType<typeof Fastify>) =>
	app.inject({
		method: "POST",
		url: "/api/admin/mixcloud/connect",
		headers: { origin: authOrigin },
	});
const callbackUrl =
	"/api/admin/mixcloud/callback?state=private-state&code=private-code";

test("callback completes authorization and redirects to a fixed upload destination", async () => {
	const { app, calls, logs } = await setup();
	await begin(app);
	const response = await app.inject(
		`${callbackUrl}&returnTo=https://attacker.example&userId=attacker`,
	);
	expect(response.statusCode).toBe(303);
	expect(response.headers.location).toBe("/admin/?mixcloud=connected#shows");
	expect(response.headers["cache-control"]).toBe("no-store");
	expect(response.headers["referrer-policy"]).toBe("no-referrer");
	expect(calls.completions).toEqual([
		{ userId: "actor", sessionId: "archive-session", state: "private-state" },
	]);
	expect(calls.provider).toEqual(["/oauth/access_token", "/me/"]);
	const status = await app.inject("/api/admin/mixcloud/status");
	expect(status.json().connected).toBe(true);
	for (const secret of [
		"private-state",
		"private-code",
		"private-token",
		"private-client-secret",
		"private-archive-token",
	])
		expect(logs.join("")).not.toContain(secret);
	expect(response.body).not.toContain("private-token");
});

test("callback rejects missing/duplicate state and never exchanges an unknown or replayed attempt", async () => {
	const { app, calls } = await setup();
	for (const query of [
		"code=private-code",
		"state=private-state&state=second&code=private-code",
		"state=&code=private-code",
		`state=${"x".repeat(1025)}&code=private-code`,
		"state=unknown&code=private-code",
	])
		expect(
			(await app.inject(`/api/admin/mixcloud/callback?${query}`)).headers
				.location,
		).toBe("/admin/?mixcloud=invalid_attempt#shows");
	expect(calls.provider).toHaveLength(0);
	await begin(app);
	await app.inject(callbackUrl);
	const replay = await app.inject(callbackUrl);
	expect(replay.headers.location).toBe(
		"/admin/?mixcloud=invalid_attempt#shows",
	);
	expect(calls.provider).toHaveLength(2);
});

test("denial consumes the attempt and preserves any previous connection", async () => {
	const { app, calls, logs } = await setup({ connected: true });
	await begin(app);
	const response = await app.inject(
		"/api/admin/mixcloud/callback?state=private-state&error=access_denied&error_description=private-provider-text",
	);
	expect(response.headers.location).toBe("/admin/?mixcloud=denied#shows");
	expect(calls.provider).toHaveLength(0);
	expect((await app.inject(callbackUrl)).headers.location).toBe(
		"/admin/?mixcloud=invalid_attempt#shows",
	);
	expect(
		(await app.inject("/api/admin/mixcloud/status")).json().connected,
	).toBe(true);
	expect(logs.join("")).not.toContain("private-provider-text");
});

test("provider and identity failures return safe redirects and preserve existing connections", async () => {
	for (const options of [{ providerFail: true }, { identityFail: true }]) {
		const { app, logs } = await setup({ ...options, connected: true });
		await begin(app);
		const response = await app.inject(callbackUrl);
		expect(response.headers.location).toBe("/admin/?mixcloud=failed#shows");
		expect(
			(await app.inject("/api/admin/mixcloud/status")).json().connected,
		).toBe(true);
		for (const secret of [
			"private-token",
			"private-provider-error",
			"private-state",
			"private-code",
		])
			expect(logs.join("")).not.toContain(secret);
	}
	const { app, logs } = await setup({ fail: true });
	expect((await app.inject(callbackUrl)).headers.location).toBe(
		"/admin/?mixcloud=failed#shows",
	);
	expect(logs.join("")).not.toContain("private-database-error");
});

test("duplicate codes and invalid OAuth responses fail before token requests", async () => {
	for (const query of [
		"state=private-state",
		"state=private-state&code=a&code=b",
		"state=private-state&error=private-error",
	]) {
		const { app, calls } = await setup();
		await begin(app);
		expect(
			(await app.inject(`/api/admin/mixcloud/callback?${query}`)).headers
				.location,
		).toBe("/admin/?mixcloud=failed#shows");
		expect(calls.provider).toHaveLength(0);
	}
});

test("disconnect clears the acting user's connection and pending attempts and is idempotent", async () => {
	const { app, calls } = await setup({ connected: true });
	await begin(app);
	for (let i = 0; i < 2; i++) {
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/mixcloud/disconnect",
			headers: { origin: authOrigin },
			payload: { userId: "attacker" },
		});
		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ disconnected: true });
	}
	expect(calls.disconnected).toEqual(["actor", "actor"]);
	expect(
		(await app.inject("/api/admin/mixcloud/status")).json().connected,
	).toBe(false);
	expect((await app.inject(callbackUrl)).headers.location).toBe(
		"/admin/?mixcloud=invalid_attempt#shows",
	);
	expect(calls.provider).toHaveLength(0);
});

test("disconnect requires a trusted browser origin and disabled routes report unavailable", async () => {
	const { app, calls, logs } = await setup();
	for (const headers of [
		{ cookie: "session=cookie", origin: "https://attacker.example" },
		{ cookie: "session=cookie" },
	]) {
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/mixcloud/disconnect?state=private-state",
			headers,
		});
		expect(response.statusCode).toBe(403);
	}
	expect(calls.disconnected).toHaveLength(0);
	expect(logs.join("")).not.toContain("private-state");
	const disabled = await setup({ configured: false });
	expect((await disabled.app.inject(callbackUrl)).headers.location).toBe(
		"/admin/?mixcloud=unavailable#shows",
	);
	expect(
		(
			await disabled.app.inject({
				method: "POST",
				url: "/api/admin/mixcloud/disconnect",
				headers: { origin: authOrigin },
			})
		).statusCode,
	).toBe(503);
});

test("application request/response logs omit callback query strings, including unauthorized callbacks", async () => {
	for (const role of ["editor", "anonymous"]) {
		const { authentication, integration } = await setup({ role });
		const app = buildApp(authentication, undefined, integration);
		apps.push(app);
		const messages: string[] = [];
		const logging = spyOn(process.stdout, "write").mockImplementation(
			(message: string | Uint8Array) => {
				messages.push(
					typeof message === "string"
						? message
						: Buffer.from(message).toString(),
				);
				return true;
			},
		);
		try {
			await app.inject(callbackUrl);
			expect(messages.join("\n")).toContain("/api/admin/mixcloud/callback");
			expect(messages.join("\n")).not.toContain("private-state");
			expect(messages.join("\n")).not.toContain("private-code");
		} finally {
			logging.mockRestore();
		}
	}
});

test("upload rejects foreign or missing origins before token access", async () => {
	const { app } = await setup();
	for (const headers of [
		{ cookie: "archive=session", origin: "https://attacker.example" },
		{ cookie: "archive=session" },
	]) {
		const response = await app.inject({
			method: "POST",
			url: "/api/admin/mixcloud/upload",
			headers,
		});
		expect(response.statusCode).toBe(403);
	}
});
