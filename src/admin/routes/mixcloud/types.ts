import { P } from "ts-pattern";
import type { ArchiveAuth } from "../../../auth/auth.js";
import type {
	MixcloudClient,
	MixcloudCloudcast,
	MixcloudIdentity,
	MixcloudStore,
} from "../../../mixcloud/index.js";
import type { AdminShowsJSON } from "../shows/types.js";
import type { AdminApiReply, ErrorResponse, TypedDatabase } from "../types.js";

export type MixcloudIntegration = {
	client: MixcloudClient;
	store: MixcloudStore;
};
export type MixcloudRouteDependencies = {
	database: TypedDatabase;
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

export type MixcloudUploadResponse =
	| ({ success: true } & UploadedShowConfirmation)
	| { success: false; uploaded?: true; key?: string; url?: string };

/** Provider upload and pending draft have both been confirmed. */
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

/** Only editorial fields may be supplied when saving an uploaded show. */
export const ReviewedUploadFieldsPattern = {
	title: P.string,
	description: P.string.maxLength(1000),
	date: P.string,
	djs: P.array(P.number.int().between(1, Number.MAX_SAFE_INTEGER)),
} as const;
export type ReviewedUploadFields = P.infer<typeof ReviewedUploadFieldsPattern>;
export type UploadedShowReview = {
	uploadId: number;
	editorial: ReviewedUploadFields;
	mixcloud: MixcloudCloudcast;
};
export type SavedUploadedShow = { created: boolean; show: AdminShowsJSON };

/** Future routes: registered only once their implementations are complete. */
export type PrepareUploadedShowRoute = {
	Params: { id: string };
	Reply: AdminApiReply<UploadedShowReview> & {
		409: ErrorResponse;
		502: ErrorResponse;
		503: ErrorResponse;
		504: ErrorResponse;
	};
};
export type SaveUploadedShowRoute = {
	Params: { id: string };
	Body: ReviewedUploadFields;
	Reply: AdminApiReply<{ show: AdminShowsJSON }> & { 409: ErrorResponse };
};
