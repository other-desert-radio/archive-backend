import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { auth } from "../auth/auth.js";

type BetterAuth = typeof auth;

const requireAuthenticatedAdminAccess = (auth: BetterAuth) => {
	return async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(request.headers),
		});

		if (!session?.user) {
			reply.code(401).send({ error: "Unauthorized" });
			reply.hijack();
			return;
		}

		if (session.user.role !== "admin") {
			reply.code(403).send({ error: "Forbidden" });
			reply.hijack();
			return;
		}
	};
};

const adminApiRoutes: FastifyPluginAsync = async (app) => {
	app.get("/", async () => ({ status: "admin api boundary ready" }));
};

const adminUiRoutes: FastifyPluginAsync = async (app) => {
	app.get("/", async (_request, reply) => {
		return reply
			.code(501)
			.type("text/plain")
			.send("Admin UI is not implemented yet.");
	});
};

export const adminRoutes = (auth: BetterAuth): FastifyPluginAsync => {
	return async (app) => {
		app.addHook("onRequest", requireAuthenticatedAdminAccess(auth));
		await app.register(adminApiRoutes, { prefix: "/api/admin" });
		await app.register(adminUiRoutes, { prefix: "/admin" });
	};
};
