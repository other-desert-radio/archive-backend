import type { ArchiveAuth } from "../../../auth/auth.js";
import type {
	MixcloudClient,
	MixcloudIdentity,
	MixcloudStore,
} from "../../../mixcloud/index.js";
import type { AdminApiReply, ErrorResponse } from "../types.js";

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

export type GetMixcloudStatusRoute = { Reply: AdminApiReply<MixcloudStatus> };

export type ConnectMixcloudRoute = {
	Reply: AdminApiReply<MixcloudConnectResponse> & { 503: ErrorResponse };
};

export type DisconnectMixcloudRoute = {
	Reply: AdminApiReply<MixcloudDisconnectResponse> & { 503: ErrorResponse };
};
