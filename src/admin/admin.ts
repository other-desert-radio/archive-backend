import multipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";
import { accountAccessGuard } from "../auth/access.js";
import type { auth } from "../auth/auth.js";
import { requireSameOrigin } from "../auth/security.js";
import { db as defaultDb } from "../db/db.js";
import { requestPathForLog } from "../utils/index.js";
import { clientDescription } from "./logging.js";
import { djRoutes } from "./routes/djs/index.js";
import {
	type MixcloudIntegration,
	mixcloudRoutes,
} from "./routes/mixcloud/index.js";
import { mixcloudImportRoutes } from "./routes/mixcloud-imports/index.js";
import {
	type PublicationRouteDependencies,
	publicationRoutes,
} from "./routes/publication/index.js";
import { showRoutes } from "./routes/shows/index.js";
import { adminStatusRoutes } from "./routes/status/index.js";
import { tagRoutes } from "./routes/tags/index.js";
import type { TypedDatabase } from "./routes/types.js";
import { adminUiRoutes } from "./routes/ui/index.js";
import { userRoutes } from "./routes/users/index.js";

export type { TypedDatabase } from "./routes/types.js";

type BetterAuth = typeof auth;

/**
 * Registers session-protected archive APIs; account management adds admin checks.
 * Public SPA assets are registered separately so sign-in can render.
 */
const adminApiRoutes = (
	auth: BetterAuth,
	database: TypedDatabase,
	publication?: Omit<PublicationRouteDependencies, "auth" | "database">,
	mixcloud?: MixcloudIntegration,
): FastifyPluginAsync => {
	return async (app) => {
		app.addHook("onRequest", accountAccessGuard(auth));
		app.addHook("onRequest", requireSameOrigin);
		app.addHook("onRequest", async (request) => {
			request.log.info(
				{
					method: request.method,
					url: requestPathForLog(request.url),
					contentType: request.headers["content-type"],
					contentLength: request.headers["content-length"],
					accept: request.headers.accept,
					client: clientDescription(request),
				},
				`[Admin API] request received -- method: ${request.method}, url: ${requestPathForLog(request.url)}`,
			);
		});
		app.addHook("onError", async (request, reply, error) => {
			request.log.error(
				{
					err: error,
					method: request.method,
					url: requestPathForLog(request.url),
					statusCode: error.statusCode ?? reply.statusCode,
					contentType: request.headers["content-type"],
					client: clientDescription(request),
				},
				"[Admin API] request failed",
			);
		});
		await app.register(multipart, {
			limits: {
				fileSize: 10 * 1024 * 1024,
				files: 1,
				fields: 8,
				parts: 9,
			},
		});
		await app.register(userRoutes(auth, database));
		if (publication !== undefined)
			await app.register(publicationRoutes({ auth, database, ...publication }));
		await app.register(adminStatusRoutes);
		await app.register(djRoutes(database));
		await app.register(showRoutes(database));
		await app.register(tagRoutes(database));
		await app.register(mixcloudImportRoutes(database));
		await app.register(
			mixcloudRoutes({
				auth,
				database,
				...(mixcloud ? { integration: mixcloud } : {}),
			}),
		);
	};
};
/**
 * Registers the authenticated admin boundary.
 *
 * `/api/admin/*` requires an admin/editor session. SPA assets at `/admin/*`
 * are public so the browser can render sign-in before a session exists.
 */
export const adminRoutes = (
	auth: BetterAuth,
	database: TypedDatabase = defaultDb,
	publication?: Omit<PublicationRouteDependencies, "auth" | "database">,
	mixcloud?: MixcloudIntegration,
): FastifyPluginAsync => {
	return async (app) => {
		await app.register(adminApiRoutes(auth, database, publication, mixcloud), {
			prefix: "/api/admin",
		});
		await app.register(adminUiRoutes, { prefix: "/admin" });
	};
};
