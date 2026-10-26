import type { FastifyPluginAsync } from "fastify";
import type { TypedDatabase } from "../types.js";
import { getMixcloudImportStatusHandler } from "./routes/get-mixcloud-import-status.js";
import { listMixcloudImportsHandler } from "./routes/list-mixcloud-imports.js";
import { refreshMixcloudHandler } from "./routes/refresh-mixcloud.js";
import type {
	GetMixcloudImportStatusRoute,
	ListMixcloudImportsRoute,
	RefreshMixcloudRoute,
} from "./types.js";

/** Registers authenticated Mixcloud import list and refresh API routes. */
export const mixcloudImportRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.post<RefreshMixcloudRoute>(
			"/refresh-mixcloud",
			refreshMixcloudHandler(database),
		);
		app.get<GetMixcloudImportStatusRoute>(
			"/mixcloud-import/status",
			getMixcloudImportStatusHandler(database),
		);
		app.get<ListMixcloudImportsRoute>(
			"/mixcloud-imports",
			listMixcloudImportsHandler(database),
		);
	};
