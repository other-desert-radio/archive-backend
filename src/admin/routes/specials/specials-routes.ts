import type { FastifyPluginAsync } from "fastify";
import type { TypedDatabase } from "../types.js";
import { createSpecialHandler } from "./routes/create-special.js";
import { getSpecialDeleteImpactHandler } from "./routes/get-special-delete-impact.js";
import { listSpecialsHandler } from "./routes/list-specials.js";
import { modifySpecialHandler } from "./routes/modify-special.js";
import { removeSpecialHandler } from "./routes/remove-special.js";
import type {
	CreateSpecialRoute,
	GetSpecialDeleteImpactRoute,
	ListSpecialsRoute,
	ModifySpecialRoute,
	RemoveSpecialRoute,
} from "./types.js";
/** Registers authenticated Specials API routes. */
export const specialRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.post<ModifySpecialRoute>(
			"/modify-special",
			modifySpecialHandler(database),
		);
		app.get<ListSpecialsRoute>("/specials", listSpecialsHandler(database));
		app.post<CreateSpecialRoute>(
			"/create-special",
			createSpecialHandler(database),
		);
		app.get<GetSpecialDeleteImpactRoute>(
			"/specials/:id/delete-impact",
			getSpecialDeleteImpactHandler(database),
		);
		app.post<RemoveSpecialRoute>(
			"/remove-special",
			removeSpecialHandler(database),
		);
	};
