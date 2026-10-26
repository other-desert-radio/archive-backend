import { resolve } from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { getAdminAssetHandler } from "./routes/get-admin-asset.js";
import { getAdminIndexHandler } from "./routes/get-admin-index.js";
import type { AdminUiRoute } from "./types.js";
/** Serves the public SPA shell and assets; APIs enforce account access. */
export const adminUiRoutes: FastifyPluginAsync = async (app) => {
	const adminUiRoot = resolve(process.cwd(), "dist/admin");
	app.get<AdminUiRoute>("/", getAdminIndexHandler(adminUiRoot));
	app.get<AdminUiRoute>("/*", getAdminAssetHandler(adminUiRoot));
};
