import type { FastifyReply, FastifyRequest } from "fastify";
import { getAccountSession } from "../../../../auth/access.js";
import { sendFailure } from "../send-failure.js";
import type {
	ConnectMixcloudRoute,
	MixcloudRouteDependencies,
} from "../types.js";

export const connectMixcloudHandler =
	(
		auth: MixcloudRouteDependencies["auth"],
		integration: MixcloudRouteDependencies["integration"],
	) =>
	async (
		request: FastifyRequest<ConnectMixcloudRoute>,
		reply: FastifyReply<ConnectMixcloudRoute>,
	) => {
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
	};
