import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import multipart from "@fastify/multipart";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
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
import { adminStatusRoutes } from "./routes/status.js";
import { tagRoutes } from "./routes/tags/index.js";
import type { ErrorResponse, TypedDatabase } from "./routes/types.js";
import { userRoutes } from "./routes/users/index.js";

export type { TypedDatabase } from "./routes/types.js";

type BetterAuth = typeof auth;

type AdminUiRoute = {
	Params: { "*"?: string };
	Reply: {
		200: Buffer;
		404: ErrorResponse;
		503: ErrorResponse;
	};
};

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
			mixcloudRoutes({ auth, ...(mixcloud ? { integration: mixcloud } : {}) }),
		);
	};
};

/** Serves the public SPA shell and assets; APIs enforce account access. */
const adminUiRoutes: FastifyPluginAsync = async (app) => {
	const adminUiRoot = resolve(process.cwd(), "dist/admin");

	const serveAdminFile = async (
		request: FastifyRequest,
		reply: FastifyReply,
	) => {
		const wildcard = (request.params as { "*"?: string })["*"];
		const relativePath = wildcard || "index.html";
		const filePath = resolve(adminUiRoot, relativePath);

		if (
			filePath !== adminUiRoot &&
			!filePath.startsWith(`${adminUiRoot}${sep}`)
		) {
			return reply.code(404).send({ error: "Not Found" });
		}

		try {
			const file = await readFile(filePath);
			return reply.type(contentTypeFor(filePath)).send(file);
		} catch (error) {
			request.log.error(error, "Unable to load admin UI asset");
			return reply.code(wildcard ? 404 : 503).send({
				error: wildcard ? "Not Found" : "Admin UI is unavailable",
			});
		}
	};

	app.get<AdminUiRoute>("/", serveAdminFile);
	app.get<AdminUiRoute>("/*", serveAdminFile);
};

const contentTypeFor = (filePath: string): string => {
	switch (extname(filePath)) {
		case ".css":
			return "text/css";
		case ".js":
			return "application/javascript";
		case ".svg":
			return "image/svg+xml";
		case ".json":
			return "application/json";
		default:
			return "text/html";
	}
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
