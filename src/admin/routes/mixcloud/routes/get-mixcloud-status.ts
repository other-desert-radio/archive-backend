import type { FastifyReply, FastifyRequest } from "fastify";
import { getAccountSession } from "../../../../auth/access.js";
import { sendFailure } from "../send-failure.js";
import type {
	GetMixcloudStatusRoute,
	MixcloudRouteDependencies,
} from "../types.js";

export const getMixcloudStatusHandler =
	(
		auth: MixcloudRouteDependencies["auth"],
		integration: MixcloudRouteDependencies["integration"],
	) =>
	async (
		request: FastifyRequest<GetMixcloudStatusRoute>,
		reply: FastifyReply<GetMixcloudStatusRoute>,
	) => {
		if (!integration) return { configured: false, connected: false } as const;
		try {
			const { user } = await getAccountSession(auth, request);
			request.log.info("[Mixcloud Status] loading");
			const account = await integration.store.getConnection(user.id);
			request.log.info("[Mixcloud Status] loaded");
			return account
				? ({ configured: true, connected: true, account } as const)
				: ({ configured: true, connected: false } as const);
		} catch (error) {
			return sendFailure(error, request, reply);
		}
	};
