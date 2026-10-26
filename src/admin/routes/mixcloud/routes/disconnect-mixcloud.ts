import type { FastifyReply, FastifyRequest } from "fastify";
import { getAccountSession } from "../../../../auth/access.js";
import { sendFailure } from "../send-failure.js";
import type {
	DisconnectMixcloudRoute,
	MixcloudRouteDependencies,
} from "../types.js";

export const disconnectMixcloudHandler =
	(
		auth: MixcloudRouteDependencies["auth"],
		integration: MixcloudRouteDependencies["integration"],
	) =>
	async (
		request: FastifyRequest<DisconnectMixcloudRoute>,
		reply: FastifyReply<DisconnectMixcloudRoute>,
	) => {
		if (!integration)
			return reply.code(503).send({ error: "Mixcloud is not configured" });
		try {
			const { user } = await getAccountSession(auth, request);
			request.log.info("[Mixcloud Disconnect] disconnecting");
			await integration.store.disconnect(user.id);
			request.log.info("[Mixcloud Disconnect] disconnected");
			return { disconnected: true } as const;
		} catch (error) {
			return sendFailure(error, request, reply);
		}
	};
