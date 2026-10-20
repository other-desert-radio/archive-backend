import type { FastifyPluginAsync } from "fastify";
import type { ArchiveAuth } from "../../../auth/auth.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationJobDetail,
	PublicationNotifications,
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
export type PublicationJobRoute = {
	Params: { jobId: string };
	Reply: PublicationRouteReply<PublicationJobDetail>;
};
/** GET/POST /publication, GET /publication/jobs/:jobId, GET /publication/events.
 * Admin-only beneath shared session/origin guards; SSE revalidates sessions.
 * Initial connection and reconnect read durable state before forwarding updates.
 */

export const publicationRoutes = (
	_dependencies: PublicationRouteDependencies,
): FastifyPluginAsync => {
	throw new Error("Not implemented: publicationRoutes");
};
