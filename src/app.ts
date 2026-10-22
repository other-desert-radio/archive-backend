import Fastify from "fastify";
import { adminRoutes } from "./admin/admin.js";
import type { MixcloudIntegration } from "./admin/routes/mixcloud/index.js";
import type { PublicationRouteDependencies } from "./admin/routes/publication/index.js";
import { accountRoutes } from "./auth/account-routes.js";
import type { auth } from "./auth/auth.js";
import { authRoutes } from "./auth/routes.js";
import { db } from "./db/db.js";
import { requestPathForLog } from "./utils/index.js";
import { PrettyLogStream } from "./utils/pretty-log-stream.js";

type BetterAuth = typeof auth;

export const buildApp = (
	auth: BetterAuth,
	publication?: Omit<PublicationRouteDependencies, "auth" | "database">,
	mixcloud?: MixcloudIntegration,
) => {
	const app = Fastify({
		disableRequestLogging: true,
		logger: {
			timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
			stream: new PrettyLogStream(),
		},
	});
	app.addHook("onRequest", async (request) => {
		request.log.info(
			`[HTTP] incoming request -- method: ${request.method}, url: ${requestPathForLog(request.url)}`,
		);
	});
	app.addHook("onResponse", async (request, reply) => {
		request.log.info(
			`[HTTP] request completed -- method: ${request.method}, url: ${requestPathForLog(request.url)}, status: ${reply.statusCode}`,
		);
	});

	app.get("/health", async () => ({ status: "ok" }));
	app.register(adminRoutes(auth, db, publication, mixcloud));
	app.register(authRoutes(auth));
	app.register(accountRoutes(auth, db));

	return app;
};
