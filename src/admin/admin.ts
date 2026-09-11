import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { auth } from "../auth/auth.js";

type BetterAuth = typeof auth;

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

export const adminRoutes = (auth?: BetterAuth): FastifyPluginAsync => {
  const guard = auth
    ? requireAuthenticatedAdminAccess(auth)
    : requireTemporaryAdminAccess;

  return async (app) => {
    app.addHook("onRequest", guard);
    await app.register(adminApiRoutes, { prefix: "/api/admin" });
    await app.register(adminUiRoutes, { prefix: "/admin" });
  };
};
