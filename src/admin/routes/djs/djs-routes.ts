import type { FastifyPluginAsync } from "fastify";
import type { TypedDatabase } from "../types.js";
import { createDJHandler } from "./routes/create-dj.js";
import { getDJDefaultImageHandler } from "./routes/get-dj-default-image.js";
import { getDJImageHandler } from "./routes/get-dj-image.js";
import { listDJsHandler } from "./routes/list-djs.js";
import { modifyDJHandler } from "./routes/modify-dj.js";
import { removeDJHandler } from "./routes/remove-dj.js";
import type {
	CreateDJRoute,
	GetDJDefaultImageRoute,
	GetDJImageRoute,
	ListDJsRoute,
	ModifyDJRoute,
} from "./types.js";

/** Registers authenticated DJ API routes. */
export const djRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<ListDJsRoute>("/djs", listDJsHandler(database));

		app.get<GetDJImageRoute>(
			"/djs/:id/image/:variant",
			getDJImageHandler(database),
		);

		app.get<GetDJDefaultImageRoute>(
			"/djs/:id/image",
			getDJDefaultImageHandler(database),
		);

		app.post<CreateDJRoute>("/create-dj", createDJHandler(database));

		app.post<ModifyDJRoute>("/modify-dj", modifyDJHandler(database));

		app.post("/remove-dj", removeDJHandler);
	};
