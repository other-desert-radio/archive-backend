import type { ArchiveAuth } from "../../../auth/auth.js";
import type {
	MixcloudClient,
	MixcloudIdentity,
	MixcloudStore,
} from "../../../mixcloud/index.js";

export type MixcloudIntegration = {
	client: MixcloudClient;
	store: MixcloudStore;
};
export type MixcloudRouteDependencies = {
	auth: ArchiveAuth;
	integration?: MixcloudIntegration;
};

export type MixcloudStatus =
	| { configured: false; connected: false }
	| { configured: true; connected: false }
	| { configured: true; connected: true; account: MixcloudIdentity };
export type MixcloudConnectResponse = { authorizationUrl: string };
export type MixcloudDisconnectResponse = { disconnected: true };
export type MixcloudCallbackOutcome =
	| "connected"
	| "denied"
	| "invalid_attempt"
	| "unavailable"
	| "failed";
