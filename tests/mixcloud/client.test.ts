import { expect, test } from "bun:test";
import {
	createMixcloudClient,
	type MixcloudConfig,
} from "../../src/mixcloud/index.js";

const config: MixcloudConfig = {
	clientId: "client-id",
	clientSecret: "secret-do-not-log",
	redirectUri: "http://localhost:43827/api/admin/mixcloud/callback",
	tokenEncryptionKey: Buffer.alloc(32).toString("base64"),
};
const callback = () =>
	new URLSearchParams({ code: "private-code", state: "random-state" });

test("authorization URL contains state and callback, never server secrets", () => {
	const client = createMixcloudClient(config);
	const url = new URL(client.authorizationUrl("state+&value"));
	expect(url.origin + url.pathname).toBe(
		"https://www.mixcloud.com/oauth/authorize",
	);
	expect(url.searchParams.get("state")).toBe("state+&value");
	expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
	expect(url.searchParams.get("client_id")).toBe(config.clientId);
	expect(url.toString()).not.toContain(config.clientSecret);
});

test("library validates callback and adapter sends documented GET exchange", async () => {
	let requests = 0;
	const client = createMixcloudClient(config, {
		fetcher: async (url, options) => {
			requests++;
			expect(url.origin + url.pathname).toBe(
				"https://www.mixcloud.com/oauth/access_token",
			);
			expect(options.method).toBe("GET");
			expect(options.redirect).toBe("error");
			expect(options.body).toBeUndefined();
			expect(url.searchParams.get("client_secret")).toBe(config.clientSecret);
			expect(url.searchParams.get("code")).toBe("private-code");
			expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
			return new Response("access_token=token%2Bvalue");
		},
	});
	expect(await client.exchangeCode(callback(), "random-state")).toBe(
		"token+value",
	);
	expect(requests).toBe(1);
});

test("invalid state, denial and duplicate code are rejected before network access", async () => {
	let requests = 0;
	const client = createMixcloudClient(config, {
		fetcher: async () => {
			requests++;
			return new Response();
		},
	});
	for (const parameters of [
		new URLSearchParams({ code: "code", state: "wrong" }),
		new URLSearchParams({ error: "access_denied", state: "random-state" }),
		new URLSearchParams("code=a&code=b&state=random-state"),
		new URLSearchParams({ state: "random-state" }),
	])
		await expect(
			client.exchangeCode(parameters, "random-state"),
		).rejects.toThrow();
	expect(requests).toBe(0);
});

test("accepts JSON token response as well as documented form response", async () => {
	const client = createMixcloudClient(config, {
		fetcher: async () => Response.json({ access_token: "json-token" }),
	});
	expect(await client.exchangeCode(callback(), "random-state")).toBe(
		"json-token",
	);
});

test("rejects provider errors and malformed token payloads with safe errors", async () => {
	for (const response of [
		new Response("secret-do-not-log", { status: 500 }),
		new Response("access_token="),
		new Response("access_token=a&access_token=b"),
		new Response("error=denied&access_token=a"),
		new Response("<html>error</html>"),
		Response.json({ access_token: 42 }),
		Response.json({ access_token: "token", error: "denied" }),
	]) {
		const client = createMixcloudClient(config, {
			fetcher: async () => response,
		});
		await expect(
			client.exchangeCode(callback(), "random-state"),
		).rejects.toThrow("Mixcloud token_exchange_failed");
	}
});

test("identity lookup validates and normalizes the account", async () => {
	const client = createMixcloudClient(config, {
		fetcher: async (url, options) => {
			expect(url.origin + url.pathname).toBe("https://api.mixcloud.com/me/");
			expect(url.searchParams.get("access_token")).toBe("private-token");
			expect(options.redirect).toBe("error");
			return Response.json({
				key: "/otherdesertradio/",
				name: " Other Desert Radio ",
			});
		},
	});
	expect(await client.getIdentity("private-token")).toEqual({
		key: "/otherdesertradio/",
		displayName: "Other Desert Radio",
	});
});

test("identity failures do not expose responses or raw network errors", async () => {
	for (const response of [
		Response.json({ key: "/user/", name: " " }),
		Response.json({ key: "/user/show/", name: "name" }),
		new Response("private-token", { status: 500 }),
		new Response("bad json"),
	]) {
		const client = createMixcloudClient(config, {
			fetcher: async () => response,
		});
		await expect(client.getIdentity("private-token")).rejects.toThrow(
			"Mixcloud identity_failed",
		);
	}
	const client = createMixcloudClient(config, {
		fetcher: async () => {
			throw new Error("secret-do-not-log private-token");
		},
	});
	await expect(client.getIdentity("private-token")).rejects.toThrow(
		"Mixcloud identity_failed",
	);
	await expect(client.exchangeCode(callback(), "random-state")).rejects.toThrow(
		"Mixcloud token_exchange_failed",
	);
});

test("401 identity response requests reconnection", async () => {
	const client = createMixcloudClient(config, {
		fetcher: async () => new Response("", { status: 401 }),
	});
	await expect(client.getIdentity("token")).rejects.toThrow(
		"Mixcloud invalid_token",
	);
});

test("token and identity requests have an aborting timeout", async () => {
	const client = createMixcloudClient(config, {
		timeoutMs: 5,
		fetcher: async (_url, options) =>
			new Promise((_resolve, reject) => {
				options.signal?.addEventListener(
					"abort",
					() => reject(new Error("private-token timeout")),
					{ once: true },
				);
			}),
	});
	await expect(client.exchangeCode(callback(), "random-state")).rejects.toThrow(
		"Mixcloud token_exchange_failed",
	);
	await expect(client.getIdentity("private-token")).rejects.toThrow(
		"Mixcloud identity_failed",
	);
});

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

test("fetches a single uploaded cloudcast at the fixed API origin without credentials", async () => {
	const client = createMixcloudClient(config, {
		fetcher: async (url, options) => {
			expect(url.href).toBe("https://api.mixcloud.com/odr/show/");
			expect(options).toMatchObject({ method: "GET", redirect: "error" });
			expect(options.signal).toBeInstanceOf(AbortSignal);
			return Response.json(cloudcast);
		},
	});
	expect(await client.getCloudcast(cloudcast.key)).toEqual(cloudcast);
});

test("rejects unsafe cloudcast keys before fetching", async () => {
	let calls = 0;
	const client = createMixcloudClient(config, {
		fetcher: async () => {
			calls++;
			return Response.json(cloudcast);
		},
	});
	for (const key of [
		"//evil.test/x/",
		"https://evil.test/",
		"/odr/../",
		"/odr/show/?token=secret",
		"/odr/",
	])
		await expect(client.getCloudcast(key)).rejects.toThrow("cloudcast_failed");
	expect(calls).toBe(0);
});

test("rejects invalid uploaded metadata and mismatched keys", async () => {
	for (const changes of [
		{ key: "/other/show/" },
		{ audio_length: 0 },
		{ audio_length: 1.5 },
		{ audio_length: 2_147_483_648 },
		{ url: "javascript:alert(1)" },
		{ pictures: { ...cloudcast.pictures, large: "relative" } },
		{
			tags: [
				{
					key: "/genres/house/",
					name: " ",
					url: "https://www.mixcloud.com/genres/house/",
				},
			],
		},
		{ error: "secret" },
	]) {
		const client = createMixcloudClient(config, {
			fetcher: async () => Response.json({ ...cloudcast, ...changes }),
		});
		await expect(client.getCloudcast(cloudcast.key)).rejects.toThrow(
			"cloudcast_failed",
		);
	}
});

test("single-cloudcast failures use safe errors and do not retry", async () => {
	for (const response of [
		new Response("private-provider-error", { status: 404 }),
		new Response("not-json"),
	]) {
		let calls = 0;
		const client = createMixcloudClient(config, {
			fetcher: async () => {
				calls++;
				return response;
			},
		});
		await expect(client.getCloudcast(cloudcast.key)).rejects.toMatchObject({
			message: "Mixcloud cloudcast_failed",
			providerStatus: response.status,
			failureReason: response.ok ? "invalid_json" : "http_error",
		});
		expect(calls).toBe(1);
	}
	const timeout = createMixcloudClient(config, {
		fetcher: async () => {
			throw new DOMException("private-token", "TimeoutError");
		},
	});
	await expect(timeout.getCloudcast(cloudcast.key)).rejects.toThrow(
		"cloudcast_timeout",
	);
});

test("metadata diagnostics distinguish safe failure reasons without provider payloads", async () => {
	const cases = [
		[Response.json({ ...cloudcast, audio_length: 0 }), "invalid_metadata"],
		[Response.json({ ...cloudcast, key: "/odr/other/" }), "key_mismatch"],
		[
			Response.json({ error: { message: "private-provider-error" } }),
			"provider_error",
		],
	] as const;
	for (const [response, failureReason] of cases) {
		const client = createMixcloudClient(config, {
			fetcher: async () => response,
		});
		await expect(client.getCloudcast(cloudcast.key)).rejects.toMatchObject({
			failureReason,
			providerStatus: 200,
			message: "Mixcloud cloudcast_failed",
		});
	}
	for (const [error, failureReason] of [
		[new Error("private-network-error"), "network_error"],
		[new DOMException("private-timeout", "TimeoutError"), "timeout"],
	] as const) {
		const client = createMixcloudClient(config, {
			fetcher: async () => {
				throw error;
			},
		});
		await expect(client.getCloudcast(cloudcast.key)).rejects.toMatchObject({
			failureReason,
			providerStatus: undefined,
		});
	}
});
