import { expect, test } from "bun:test";
import { createTokenEncryption } from "../../src/mixcloud/token-encryption.js";

const key = Buffer.alloc(32, 19).toString("base64");

test("encrypts with fresh nonces and survives recreation with the same key", () => {
	const encryption = createTokenEncryption(key);
	const first = encryption.encrypt("private-access-token", "user-one");
	const second = encryption.encrypt("private-access-token", "user-one");
	expect(first).not.toBe(second);
	expect(first).not.toContain("private-access-token");
	expect(createTokenEncryption(key).decrypt(first, "user-one")).toBe(
		"private-access-token",
	);
});

test("wrong owner, wrong key, and tampered envelope cannot decrypt", () => {
	const encryption = createTokenEncryption(key);
	const envelope = encryption.encrypt("private-access-token", "user-one");
	expect(() => encryption.decrypt(envelope, "user-two")).toThrow(
		"Unable to decrypt Mixcloud token",
	);
	expect(() =>
		createTokenEncryption(Buffer.alloc(32, 20).toString("base64")).decrypt(
			envelope,
			"user-one",
		),
	).toThrow("Unable to decrypt Mixcloud token");
	const parts = envelope.split(".");
	for (const index of [1, 2, 3]) {
		const altered = [...parts];
		const bytes = Buffer.from(altered[index] ?? "", "base64");
		bytes[0] = (bytes[0] ?? 0) ^ 1;
		altered[index] = bytes.toString("base64");
		expect(() => encryption.decrypt(altered.join("."), "user-one")).toThrow(
			"Unable to decrypt Mixcloud token",
		);
	}
	for (const invalid of [
		"",
		"v2.a.b.c",
		`${envelope}.extra`,
		envelope.replace(/=\./, "."),
	])
		expect(() => encryption.decrypt(invalid, "user-one")).toThrow(
			"Unable to decrypt Mixcloud token",
		);
});

test("invalid keys and empty encryption inputs fail without echoing secrets", () => {
	for (const invalid of [
		"",
		"private-secret",
		Buffer.alloc(31).toString("base64"),
		`${key}!`,
	])
		expect(() => createTokenEncryption(invalid)).toThrow(
			"Invalid Mixcloud encryption key",
		);
	const encryption = createTokenEncryption(key);
	expect(() => encryption.encrypt(" ", "user-one")).toThrow(
		"Invalid Mixcloud token input",
	);
	expect(() => encryption.encrypt("private-access-token", "")).toThrow(
		"Invalid Mixcloud token input",
	);
});
