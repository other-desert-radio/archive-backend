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
	_environment: NodeJS.ProcessEnv,
): MixcloudConfig | undefined => {
	throw new Error("Not implemented: readMixcloudConfig");
};
