import type { FastifyPluginAsync } from "fastify";
import type { TypedDatabase } from "../../admin/routes/types.js";
import type { ArchiveAuth } from "../../auth/auth.js";
import { requireSameOrigin } from "../../auth/security.js";
import { changePasswordHandler } from "./routes/change-password.js";
import type { ChangePasswordRoute } from "./types.js";

/** Signed-in accounts may replace their own password, including temporary ones. */
export const accountRoutes =
	(auth: ArchiveAuth, database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", requireSameOrigin);
		app.post<ChangePasswordRoute>(
			"/api/account/change-password",
			changePasswordHandler(auth, database),
		);
	};
