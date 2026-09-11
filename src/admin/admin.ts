import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

/**
 * Temporarily protects admin routes with a shared bearer token.
 *
 * Access requires `Authorization: Bearer <ADMIN_LOCAL_TOKEN>`. The guard
 * fails closed when the environment variable is missing or the token does
 * not match. Better Auth will replace this guard in the authentication phase.
 */
const requireTemporaryAdminAccess = async (
	request: FastifyRequest,
	reply: FastifyReply,
): Promise<void> => {
	const configuredToken = process.env.ADMIN_LOCAL_TOKEN;
	const authorization = request.headers.authorization;

	if (!configuredToken || authorization !== `Bearer ${configuredToken}`) {
		reply
			.code(401)
			.header("WWW-Authenticate", "Bearer")
			.send({ error: "Unauthorized" });
		reply.hijack();
	}
};

const adminApiRoutes: FastifyPluginAsync = async (app) => {
	app.addHook("onRequest", requireTemporaryAdminAccess);

	app.get("/", async () => ({ status: "admin api boundary ready" }));
};

const adminUiRoutes: FastifyPluginAsync = async (app) => {
	app.addHook("onRequest", requireTemporaryAdminAccess);

	app.get("/", async (_request, reply) => {
		return reply
			.code(501)
			.type("text/plain")
			.send("Admin UI is not implemented yet.");
	});
};

export const adminRoutes: FastifyPluginAsync = async (app) => {
	await app.register(adminApiRoutes, { prefix: "/api/admin" });
	await app.register(adminUiRoutes, { prefix: "/admin" });
};
