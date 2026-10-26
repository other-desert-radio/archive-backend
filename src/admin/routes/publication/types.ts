import type { ArchiveAuth } from "../../../auth/auth.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationJobDetail,
	PublicationNotifications,
	PublicationPreview,
	PublicationRunner,
	PublicationStatus,
} from "../../../publication/index.js";
import type { ErrorResponse, TypedDatabase } from "../types.js";

export type PublicationRouteDependencies = {
	auth: ArchiveAuth;
	database: TypedDatabase;
	config: PublicationConfig;
	runner: PublicationRunner;
	notifications: PublicationNotifications;
};
export type PublicationRouteReply<T> = {
	200: T;
	400: ErrorResponse;
	401: ErrorResponse;
	403: ErrorResponse;
	404: ErrorResponse;
	409: ErrorResponse;
	500: ErrorResponse;
	503: ErrorResponse;
};
export type PublicationStatusRoute = {
	Reply: PublicationRouteReply<PublicationStatus>;
};
export type PublicationStartRoute = {
	Body: unknown;
	Reply: PublicationRouteReply<PublicationJob> & { 202: PublicationJob };
};
export type PublicationPreviewRoute = {
	Body: unknown;
	Reply: PublicationRouteReply<PublicationPreview>;
};
export type PublicationJobRoute = {
	Params: { jobId: string };
	Reply: PublicationRouteReply<PublicationJobDetail>;
};
