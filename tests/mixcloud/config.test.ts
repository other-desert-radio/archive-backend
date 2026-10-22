import { expect, test } from "bun:test";
import { readMixcloudConfig } from "../../src/mixcloud/index.js";

const configured = {
	MIXCLOUD_CLIENT_ID: "test-client",
	MIXCLOUD_CLIENT_SECRET: "private-test-secret",
	MIXCLOUD_REDIRECT_URI: "http://localhost:43827/api/admin/mixcloud/callback",
	MIXCLOUD_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 17).toString("base64"),
};

test("absent or blank settings disable Mixcloud", () => {
	expect(readMixcloudConfig({})).toBeUndefined();
	expect(
		readMixcloudConfig(
			Object.fromEntries(Object.keys(configured).map((key) => [key, "  "])),
		),
	).toBeUndefined();
});

test("reads complete settings and trims surrounding whitespace", () => {
	expect(
		readMixcloudConfig({ ...configured, MIXCLOUD_CLIENT_ID: " test-client " }),
	).toEqual({
		clientId: "test-client",
		clientSecret: configured.MIXCLOUD_CLIENT_SECRET,
		redirectUri: configured.MIXCLOUD_REDIRECT_URI,
		tokenEncryptionKey: configured.MIXCLOUD_TOKEN_ENCRYPTION_KEY,
	});
});

test("each missing setting rejects partial configuration without exposing secrets", () => {
	for (const name of Object.keys(configured)) {
		const environment: NodeJS.ProcessEnv = { ...configured };
		delete environment[name];
		expect(() => readMixcloudConfig(environment)).toThrow(name);
		try {
			readMixcloudConfig(environment);
		} catch (error) {
			expect(String(error)).not.toContain(configured.MIXCLOUD_CLIENT_SECRET);
			expect(String(error)).not.toContain(
				configured.MIXCLOUD_TOKEN_ENCRYPTION_KEY,
			);
		}
	}
});

test("accepts HTTPS deployment callbacks and HTTP loopback callbacks", () => {
	for (const origin of [
		"https://archive.example.com",
		"http://127.0.0.1:43827",
		"http://[::1]:43827",
	])
		expect(
			readMixcloudConfig({
				...configured,
				MIXCLOUD_REDIRECT_URI: `${origin}/api/admin/mixcloud/callback`,
			}),
		).toBeDefined();
});

test("rejects unsafe or incorrect callback URLs without echoing them", () => {
	for (const url of [
		"invalid",
		"http://example.com/api/admin/mixcloud/callback",
		"https://user:password@example.com/api/admin/mixcloud/callback",
		"https://example.com/admin/#upload",
		`${configured.MIXCLOUD_REDIRECT_URI}?secret=value`,
		`${configured.MIXCLOUD_REDIRECT_URI}#fragment`,
		"file:///api/admin/mixcloud/callback",
	]) {
		expect(() =>
			readMixcloudConfig({ ...configured, MIXCLOUD_REDIRECT_URI: url }),
		).toThrow("MIXCLOUD_REDIRECT_URI");
	}
});

test("rejects malformed, wrong-length, and noncanonical encryption keys", () => {
	for (const key of [
		"not-base64",
		Buffer.alloc(31).toString("base64"),
		Buffer.alloc(33).toString("base64"),
		configured.MIXCLOUD_TOKEN_ENCRYPTION_KEY.replace(/=$/, ""),
		`${configured.MIXCLOUD_TOKEN_ENCRYPTION_KEY}!`,
	])
		expect(() =>
			readMixcloudConfig({ ...configured, MIXCLOUD_TOKEN_ENCRYPTION_KEY: key }),
		).toThrow("MIXCLOUD_TOKEN_ENCRYPTION_KEY");
});

test("rejects embedded whitespace and control characters in credentials", () => {
	for (const value of [
		"bad value",
		"bad\nvalue",
		"bad\u0000value",
		"bad\u007fvalue",
	])
		expect(() =>
			readMixcloudConfig({ ...configured, MIXCLOUD_CLIENT_SECRET: value }),
		).toThrow("MIXCLOUD_CLIENT_SECRET");
});
