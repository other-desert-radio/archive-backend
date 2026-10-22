import { isMatching, P } from "ts-pattern";
import type { MixcloudStatus } from "../../admin/routes/mixcloud/index.js";
import { apiFetch } from "./api-fetch.js";

const request = async (
	action: "status" | "connect" | "disconnect",
): Promise<unknown> => {
	try {
		const response = await apiFetch(`/api/admin/mixcloud/${action}`, {
			method: action === "status" ? "GET" : "POST",
			cache: "no-store",
		});
		if (!response.ok) throw new Error("Request rejected");
		return await response.json();
	} catch {
		const operation =
			action === "status"
				? "check your Mixcloud connection"
				: action === "connect"
					? "start Mixcloud sign-in"
					: "sign out of Mixcloud";
		throw new Error(`Unable to ${operation}. Please try again.`);
	}
};

export const loadMixcloudConnection = async (): Promise<MixcloudStatus> => {
	const result = await request("status");
	if (
		isMatching(
			P.union(
				{ configured: false, connected: false },
				{ configured: true, connected: false },
				{
					configured: true,
					connected: true,
					account: {
						key: P.string.regex(/^\/[A-Za-z0-9_-]+\/$/),
						displayName: P.string.minLength(1),
					},
				},
			),
			result,
		)
	)
		return result;
	throw new Error("Unable to read your Mixcloud connection. Please try again.");
};

/** Return only the expected HTTPS consent destination, never an arbitrary redirect. */
export const connectMixcloud = async (): Promise<string> => {
	const result = await request("connect");
	if (isMatching({ authorizationUrl: P.string }, result)) {
		try {
			const url = new URL(result.authorizationUrl);
			if (
				url.origin === "https://www.mixcloud.com" &&
				url.pathname === "/oauth/authorize" &&
				!url.username &&
				!url.password &&
				!url.hash
			)
				return url.toString();
		} catch {
			/* Invalid destination uses the same safe error below. */
		}
	}
	throw new Error("Unable to start Mixcloud sign-in. Please try again.");
};

export const disconnectMixcloud = async (): Promise<void> => {
	if (!isMatching({ disconnected: true }, await request("disconnect")))
		throw new Error(
			"Unable to confirm Mixcloud sign-out. Please reload your connection status.",
		);
};
