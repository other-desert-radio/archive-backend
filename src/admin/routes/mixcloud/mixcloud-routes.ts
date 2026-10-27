import type { FastifyPluginAsync } from "fastify";
import { connectMixcloudHandler } from "./routes/connect-mixcloud.js";
import { disconnectMixcloudHandler } from "./routes/disconnect-mixcloud.js";
import { getMixcloudStatusHandler } from "./routes/get-mixcloud-status.js";
import { mixcloudCallbackHandler } from "./routes/mixcloud-callback.js";
import { getPendingUploadsHandler } from "./routes/upload/get-pending-uploads.js";
import { prepareUploadedShowHandler } from "./routes/upload/prepare-uploaded-show.js";
import { removePendingUploadHandler } from "./routes/upload/remove-pending-upload.js";
import { saveUploadedShowHandler } from "./routes/upload/save-uploaded-show.js";
import { uploadMixcloudHandler } from "./routes/upload/upload-mixcloud.js";
import type {
	ConnectMixcloudRoute,
	DisconnectMixcloudRoute,
	GetMixcloudStatusRoute,
	GetPendingUploadsRoute,
	MixcloudRouteDependencies,
	PrepareUploadedShowRoute,
	RemovePendingUploadRoute,
	SaveUploadedShowRoute,
	UploadMixcloudRoute,
} from "./types.js";

/** Authenticated admin resource; register beneath the shared session/origin boundary. */
export const mixcloudRoutes =
	({
		auth,
		integration,
		database,
	}: MixcloudRouteDependencies): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", async (_request, reply) => {
			reply.header("cache-control", "no-store");
			reply.header("referrer-policy", "no-referrer");
		});
		app.post<UploadMixcloudRoute>(
			"/mixcloud/upload",
			uploadMixcloudHandler(auth, integration, database),
		);
		app.get<GetPendingUploadsRoute>(
			"/mixcloud/uploads/pending",
			getPendingUploadsHandler(database),
		);
		app.delete<RemovePendingUploadRoute>(
			"/mixcloud/uploads/:id",
			removePendingUploadHandler(database),
		);
		app.post<PrepareUploadedShowRoute>(
			"/mixcloud/uploads/:id/prepare",
			prepareUploadedShowHandler(database, integration),
		);
		app.post<SaveUploadedShowRoute>(
			"/mixcloud/uploads/:id/save",
			saveUploadedShowHandler(database),
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
