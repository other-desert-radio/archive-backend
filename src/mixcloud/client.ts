import * as oauth from "oauth4webapi";
import { isMatching, P } from "ts-pattern";
import {
	type MixcloudCloudcast,
	UploadedCloudcastPattern,
} from "./cloudcast.js";
import type { MixcloudConfig } from "./config.js";
import {
	type MixcloudUpload,
	type MixcloudUploadResult,
	uploadToMixcloud,
} from "./upload.js";

const server: oauth.AuthorizationServer = {
	issuer: "https://www.mixcloud.com",
	authorization_endpoint: "https://www.mixcloud.com/oauth/authorize",
	token_endpoint: "https://www.mixcloud.com/oauth/access_token",
};

export type MixcloudIdentity = { key: string; displayName: string };
export type MixcloudClient = {
	/** Read a single cloudcast using a validated provider key; never uploads media. */
	getCloudcast: (key: string) => Promise<MixcloudCloudcast>;
	upload: (
		accessToken: string,
		upload: MixcloudUpload,
	) => Promise<MixcloudUploadResult>;
	authorizationUrl: (state: string) => string;
	/** Caller must first consume the session-bound authorization attempt. */
	exchangeCode: (
		parameters: URLSearchParams,
		expectedState: string,
	) => Promise<string>;
	getIdentity: (accessToken: string) => Promise<MixcloudIdentity>;
};

/** Safe to log: never attach provider payloads, request URLs, or error causes. */
export class MixcloudClientError extends Error {
	constructor(
		public readonly code:
			| "authorization_rejected"
			| "token_exchange_failed"
			| "identity_failed"
			| "invalid_token"
			| "cloudcast_failed"
			| "cloudcast_timeout",
		public readonly providerStatus?: number,
	) {
		super(`Mixcloud ${code}`);
		this.name = "MixcloudClientError";
	}
}

type ClientOptions = {
	fetcher?: (url: URL, options: RequestInit) => Promise<Response>;
	timeoutMs?: number;
};

/** OAuth validation belongs to the library; Mixcloud transport quirks stay here. */
export const createMixcloudClient = (
	config: MixcloudConfig,
	{
		fetcher = (url, options) => fetch(url, options),
		timeoutMs = 10_000,
	}: ClientOptions = {},
): MixcloudClient => {
	if (!Number.isFinite(timeoutMs) || timeoutMs < 1)
		throw new Error("Mixcloud timeout must be a positive finite duration");
	const client: oauth.Client = { client_id: config.clientId };

	return {
		async getCloudcast(key) {
			try {
				if (!/^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/$/.test(key))
					throw new Error("Invalid cloudcast key");
				const response = await fetcher(
					new URL(key, "https://api.mixcloud.com"),
					{
						method: "GET",
						redirect: "error",
						signal: AbortSignal.timeout(timeoutMs),
					},
				);
				if (!response.ok)
					throw new MixcloudClientError("cloudcast_failed", response.status);
				const data: unknown = await response.json();
				if (
					!isMatching(UploadedCloudcastPattern, data) ||
					data.key !== key ||
					"error" in data
				)
					throw new Error("Invalid cloudcast response");
				return data;
			} catch (error) {
				if (error instanceof MixcloudClientError) throw error;
				throw new MixcloudClientError(
					isMatching({ name: "TimeoutError" }, error)
						? "cloudcast_timeout"
						: "cloudcast_failed",
				);
			}
		},
		upload: (accessToken, upload) =>
			uploadToMixcloud(accessToken, upload, fetcher),
		authorizationUrl(state) {
			// Pure URL construction: state links this browser trip to a stored attempt.
			// Neither the client secret nor an access token belongs in this URL.
			if (!state.trim())
				throw new MixcloudClientError("authorization_rejected");
			const url = new URL("https://www.mixcloud.com/oauth/authorize");
			url.search = new URLSearchParams({
				client_id: config.clientId,
				redirect_uri: config.redirectUri,
				response_type: "code",
				state,
			}).toString();
			return url.toString();
		},
		async exchangeCode(parameters, expectedState) {
			// Callback query -> library validates state/error -> validated grant parameters.
			// This check does not establish session ownership, expiry, or single use;
			// those are the calling route's database-backed responsibilities.
			let validated: URLSearchParams;
			try {
				if (!expectedState.trim()) throw new Error("Missing expected state");
				validated = oauth.validateAuthResponse(
					server,
					client,
					parameters,
					expectedState,
				);
			} catch {
				throw new MixcloudClientError("authorization_rejected");
			}
			try {
				// Library builds POST form -> customFetch adapts to Mixcloud GET
				// -> provider token payload -> normalized JSON -> library token validation.
				const response = await oauth.authorizationCodeGrantRequest(
					server,
					client,
					// Populate the library form; customFetch moves credentials to the query.
					oauth.ClientSecretPost(config.clientSecret),
					validated,
					config.redirectUri,
					// Mixcloud's published flow does not document PKCE support.
					oauth.nopkce,
					{
						signal: AbortSignal.timeout(timeoutMs),
						[oauth.customFetch]: async (_url, options) => {
							// Mixcloud documents GET with query credentials instead of a POST body.
							// Copy only documented parameters to a fixed HTTPS endpoint. This URL
							// contains secrets: do not log it or forward it through redirects.
							const url = new URL(
								"https://www.mixcloud.com/oauth/access_token",
							);
							const body = new URLSearchParams(String(options?.body));
							for (const name of [
								"client_id",
								"client_secret",
								"code",
								"redirect_uri",
							])
								url.searchParams.set(name, body.get(name) ?? "");
							const result = await fetcher(url, {
								method: "GET",
								redirect: "error",
								signal: options?.signal ?? null,
							});
							if (!result.ok)
								throw new Error("Token endpoint rejected request");
							const text = await result.text();
							let token: unknown;
							// Documented response: access_token=...; also accept explicit JSON.
							// Reject error-bearing payloads and ambiguous duplicate form tokens.
							if (
								result.headers.get("content-type")?.includes("application/json")
							) {
								const data: unknown = JSON.parse(text);
								if (
									!isMatching({ access_token: P.string.minLength(1) }, data) ||
									"error" in data
								)
									throw new Error("Invalid token response");
								token = data.access_token;
							} else {
								const data = new URLSearchParams(text);
								if (
									data.has("error") ||
									data.getAll("access_token").length !== 1
								)
									throw new Error("Invalid token response");
								token = data.get("access_token");
							}
							if (!isMatching(P.string.regex(/^\S+$/), token))
								throw new Error("Invalid token");
							// Mixcloud has no documented token_type; normalize for standard processing.
							return Response.json({
								access_token: token,
								token_type: "bearer",
							});
						},
					},
				);
				const token = await oauth.processAuthorizationCodeResponse(
					server,
					client,
					response,
				);
				return token.access_token;
			} catch {
				// Do not retain a cause: network/library errors can embed sensitive URLs.
				throw new MixcloudClientError("token_exchange_failed");
			}
		},
		async getIdentity(accessToken) {
			// Server token -> HTTPS /me/?access_token=... -> validate account -> identity.
			// 401 -> invalid_token; other HTTP/network/payload failures -> identity_failed.
			try {
				if (!accessToken.trim()) throw new Error("Missing token");
				const url = new URL("https://api.mixcloud.com/me/");
				url.searchParams.set("access_token", accessToken);
				const response = await fetcher(url, {
					method: "GET",
					redirect: "error",
					signal: AbortSignal.timeout(timeoutMs),
				});
				if (response.status === 401)
					throw new MixcloudClientError("invalid_token");
				if (!response.ok) throw new Error("Identity request failed");
				const data: unknown = await response.json();
				// A user key has one path segment; reject cloudcast paths and empty names.
				// Return only fields the connection banner/storage need.
				if (
					!isMatching(
						{
							key: P.string.regex(/^\/[A-Za-z0-9_-]+\/$/),
							name: P.string.minLength(1),
						},
						data,
					) ||
					"error" in data ||
					!data.name.trim()
				)
					throw new Error("Invalid identity response");
				return { key: data.key, displayName: data.name.trim() };
			} catch (error) {
				if (error instanceof MixcloudClientError) throw error;
				throw new MixcloudClientError("identity_failed");
			}
		},
	};
};
