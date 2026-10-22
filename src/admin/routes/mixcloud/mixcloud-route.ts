import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { AccountError, getAccountSession } from "../../../auth/access.js";
import type { AdminApiReply, ErrorResponse } from "../types.js";
import type {
	MixcloudConnectResponse,
	MixcloudRouteDependencies,
	MixcloudStatus,
} from "./types.js";

const sendFailure = (
	error: unknown,
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	if (error instanceof AccountError)
		return reply.code(error.status).send({
			error: error.message,
			...(error.code ? { code: error.code } : {}),
		});
	// Handle here so parent error hooks never receive database query parameters.
	request.log.error(`[Mixcloud] request failed -- reference: ${request.id}`);
	return reply
		.code(500)
		.send({ error: "Unable to access Mixcloud connection" });
};

/** Authenticated admin resource; register beneath the shared session/origin boundary. */
export const mixcloudRoutes =
	({ auth, integration }: MixcloudRouteDependencies): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", async (_request, reply) => {
			reply.header("cache-control", "no-store");
		});
		app.get<{ Reply: AdminApiReply<MixcloudStatus> }>(
			"/mixcloud/status",
			async (request, reply) => {
				if (!integration) return { configured: false, connected: false };
				try {
					const { user } = await getAccountSession(auth, request);
					request.log.info("[Mixcloud Status] loading");
					const account = await integration.store.getConnection(user.id);
					request.log.info("[Mixcloud Status] loaded");
					return account
						? { configured: true, connected: true, account }
						: { configured: true, connected: false };
				} catch (error) {
					return sendFailure(error, request, reply);
				}
			},
		);
		app.post<{
			Reply: AdminApiReply<MixcloudConnectResponse> & { 503: ErrorResponse };
		}>("/mixcloud/connect", async (request, reply) => {
			if (!integration)
				return reply.code(503).send({ error: "Mixcloud is not configured" });
			try {
				const { user, session } = await getAccountSession(auth, request);
				request.log.info("[Mixcloud Connect] starting");
				const state = await integration.store.createAttempt({
					userId: user.id,
					sessionId: session.id,
				});
				const authorizationUrl = integration.client.authorizationUrl(state);
				request.log.info("[Mixcloud Connect] authorization ready");
				return { authorizationUrl };
			} catch (error) {
				return sendFailure(error, request, reply);
			}
		});
	};
