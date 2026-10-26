import type { FastifyPluginAsync } from "fastify";
import { accountAccessGuard } from "../../../auth/access.js";
import { getPublicationJobHandler } from "./routes/get-publication-job.js";
import { getPublicationStatusHandler } from "./routes/get-publication-status.js";
import { previewPublicationHandler } from "./routes/preview-publication.js";
import { publicationEventsHandler } from "./routes/publication-events.js";
import { startPublicationHandler } from "./routes/start-publication.js";
import type {
	PublicationJobRoute,
	PublicationPreviewRoute,
	PublicationRouteDependencies,
	PublicationStartRoute,
	PublicationStatusRoute,
} from "./types.js";
/** GET/POST /publication, GET /publication/jobs/:jobId, GET /publication/events.
 * Admin-only beneath shared session/origin guards; SSE revalidates sessions.
 * Initial connection and reconnect read durable state before forwarding updates.
 */

export const publicationRoutes =
	({
		auth,
		database,
		config,
		runner,
		notifications,
	}: PublicationRouteDependencies): FastifyPluginAsync =>
	async (app) => {
		const streams = new Set<() => void>();
		app.addHook("preClose", async () => {
			for (const close of streams) close();
		});
		app.addHook("onRequest", accountAccessGuard(auth, true));
		app.get<PublicationStatusRoute>(
			"/publication",
			getPublicationStatusHandler(database, config),
		);
		app.get<PublicationJobRoute>(
			"/publication/jobs/:jobId",
			getPublicationJobHandler(database),
		);
		app.post<PublicationPreviewRoute>(
			"/publication/preview",
			previewPublicationHandler(auth, database, runner),
		);
		app.post<PublicationStartRoute>(
			"/publication",
			startPublicationHandler(auth, database, config, runner),
		);
		app.get(
			"/publication/events",
			publicationEventsHandler(auth, database, config, notifications, streams),
		);
	};

export type {
	PublicationJobRoute,
	PublicationPreviewRoute,
	PublicationRouteDependencies,
	PublicationRouteReply,
	PublicationStartRoute,
	PublicationStatusRoute,
} from "./types.js";
