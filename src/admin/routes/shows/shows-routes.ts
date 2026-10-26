import type { FastifyPluginAsync } from "fastify";
import type { TypedDatabase } from "../types.js";
import { createShowHandler } from "./routes/create-show.js";
import { listShowsHandler } from "./routes/list-shows.js";
import { modifyShowHandler } from "./routes/modify-show.js";
import type {
	CreateShowRoute,
	ListShowsRoute,
	ModifyShowRoute,
} from "./types.js";

/** Registers authenticated Shows API routes. */
export const showRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<ListShowsRoute>("/shows", listShowsHandler(database));

		app.post<CreateShowRoute>("/create-show", createShowHandler(database));

		app.post<ModifyShowRoute>("/modify-show", modifyShowHandler(database));
	};
