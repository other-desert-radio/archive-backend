/** Server-only settings; never serialize this object into API responses or logs. */
export type MixcloudConfig = {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	/** Base64-encoded 32-byte key for authenticated access-token encryption. */
	tokenEncryptionKey: string;
};

/**
 * Read the four MIXCLOUD_* settings without side effects.
 * All absent/blank returns undefined; partial or invalid settings throw a safe
 * configuration error naming the setting, never its value.
 */
export const readMixcloudConfig = (
	environment: NodeJS.ProcessEnv,
): MixcloudConfig | undefined => {
	const names = [
		"MIXCLOUD_CLIENT_ID",
		"MIXCLOUD_CLIENT_SECRET",
		"MIXCLOUD_REDIRECT_URI",
		"MIXCLOUD_TOKEN_ENCRYPTION_KEY",
	] as const;
	const values = names.map((name) => (environment[name] ?? "").trim());
	if (values.every((value) => value === "")) return undefined;
	for (const name of names) {
		const value = (environment[name] ?? "").trim();
		if (
			!value ||
			/\s/.test(value) ||
			Array.from(value).some((character) => {
				const code = character.charCodeAt(0);
				return code < 32 || code === 127;
			})
		)
			throw new Error(
				`${name} must be nonempty and contain no whitespace or control characters`,
			);
	}
	const clientId = environment.MIXCLOUD_CLIENT_ID?.trim() ?? "";
	const clientSecret = environment.MIXCLOUD_CLIENT_SECRET?.trim() ?? "";
	const redirectUri = environment.MIXCLOUD_REDIRECT_URI?.trim() ?? "";
	const tokenEncryptionKey =
		environment.MIXCLOUD_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
	let callback: URL;
	try {
		callback = new URL(redirectUri);
	} catch {
		throw new Error(
			"MIXCLOUD_REDIRECT_URI must be an absolute HTTP(S) callback URL",
		);
	}
	if (
		(callback.protocol !== "https:" &&
			!(
				callback.protocol === "http:" &&
				["localhost", "127.0.0.1", "[::1]"].includes(callback.hostname)
			)) ||
		callback.username ||
		callback.password ||
		callback.search ||
		callback.hash ||
		callback.pathname !== "/api/admin/mixcloud/callback"
	)
		throw new Error(
			"MIXCLOUD_REDIRECT_URI must use HTTPS (HTTP allowed on loopback) and the /api/admin/mixcloud/callback path without credentials, query, or fragment",
		);
	const key = Buffer.from(tokenEncryptionKey, "base64");
	if (key.length !== 32 || key.toString("base64") !== tokenEncryptionKey)
		throw new Error(
			"MIXCLOUD_TOKEN_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key",
		);
	return { clientId, clientSecret, redirectUri, tokenEncryptionKey };
};
