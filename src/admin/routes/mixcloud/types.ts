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

export type MixcloudUploadResponse = { success: boolean };

/** Future success reply; wired into the live route only after implementation. */
export type UploadedShowConfirmation = {
	uploadId: number;
	key: string;
	url: string;
};

/** Multipart title, date, JSON tag names, and one MP3 file. */
export type UploadMixcloudRoute = {
	Reply: Omit<AdminApiReply<MixcloudUploadResponse>, 400 | 500> & {
		400: MixcloudUploadResponse;
		413: MixcloudUploadResponse;
		500: MixcloudUploadResponse;
		403: MixcloudUploadResponse;
		429: MixcloudUploadResponse;
		502: MixcloudUploadResponse;
		503: MixcloudUploadResponse;
		504: MixcloudUploadResponse;
	};
};
