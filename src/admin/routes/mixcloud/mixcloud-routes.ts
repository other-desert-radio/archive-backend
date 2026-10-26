import type { FastifyPluginAsync } from "fastify";
import { connectMixcloudHandler } from "./routes/connect-mixcloud.js";
import { disconnectMixcloudHandler } from "./routes/disconnect-mixcloud.js";
import { getMixcloudStatusHandler } from "./routes/get-mixcloud-status.js";
import { mixcloudCallbackHandler } from "./routes/mixcloud-callback.js";
import { uploadMixcloudHandler } from "./routes/upload/upload-mixcloud.js";
import type {
	ConnectMixcloudRoute,
	DisconnectMixcloudRoute,
	GetMixcloudStatusRoute,
	MixcloudRouteDependencies,
	UploadMixcloudRoute,
} from "./types.js";

/** Authenticated admin resource; register beneath the shared session/origin boundary. */
export const mixcloudRoutes =
	({ auth, integration }: MixcloudRouteDependencies): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", async (_request, reply) => {
			reply.header("cache-control", "no-store");
			reply.header("referrer-policy", "no-referrer");
		});
		app.post<UploadMixcloudRoute>(
			"/mixcloud/upload",
			uploadMixcloudHandler(auth, integration),
		);
		app.get<GetMixcloudStatusRoute>(
			"/mixcloud/status",
			getMixcloudStatusHandler(auth, integration),
		);
		app.post<ConnectMixcloudRoute>(
			"/mixcloud/connect",
			connectMixcloudHandler(auth, integration),
		);
		app.get("/mixcloud/callback", mixcloudCallbackHandler(auth, integration));
		app.post<DisconnectMixcloudRoute>(
			"/mixcloud/disconnect",
			disconnectMixcloudHandler(auth, integration),
		);
	};
