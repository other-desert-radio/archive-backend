import type { FastifyPluginAsync } from "fastify";
import { requireSameOrigin } from "../../auth/security.js";
import { authProxyHandler } from "./routes/auth-proxy.js";
import type { AuthHandler } from "./types.js";

/** Only sign-in, session and sign-out are exposed; mutations use guarded APIs. */
export const authRoutes =
	(auth: AuthHandler): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", requireSameOrigin);
		app.route({
			method: ["GET", "POST"],
			url: "/api/auth/*",
			handler: authProxyHandler(auth),
		});
	};
