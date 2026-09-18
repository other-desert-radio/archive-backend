import Fastify from "fastify";
import { adminRoutes } from "./admin/admin.js";
import type { auth } from "./auth/auth.js";
import { authRoutes } from "./auth/routes.js";
import { PrettyLogStream } from "./utils/pretty-log-stream.js";

type BetterAuth = typeof auth;

export const buildApp = (auth: BetterAuth) => {
	const app = Fastify({
		disableRequestLogging: true,
		logger: {
			timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
			stream: new PrettyLogStream(),
		},
	});
	app.addHook("onRequest", async (request) => {
		request.log.info(
			`[HTTP] incoming request -- method: ${request.method}, url: ${request.url}`,
		);
	});
	app.addHook("onResponse", async (request, reply) => {
		request.log.info(
			`[HTTP] request completed -- method: ${request.method}, url: ${request.url}, status: ${reply.statusCode}`,
		);
	});

	app.get("/health", async () => ({ status: "ok" }));
	app.register(adminRoutes(auth));
	app.register(authRoutes(auth));

	return app;
};
