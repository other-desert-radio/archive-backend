import type { FastifyPluginAsync } from "fastify";
import type { TypedDatabase } from "../types.js";
import { createTagHandler } from "./routes/create-tag.js";
import { createTagsHandler } from "./routes/create-tags.js";
import { getTagDeleteImpactHandler } from "./routes/get-tag-delete-impact.js";
import { listTagsHandler } from "./routes/list-tags.js";
import { modifyTagHandler } from "./routes/modify-tag.js";
import { removeTagHandler } from "./routes/remove-tag.js";
import { validateTagsHandler } from "./routes/validate-tags.js";
import type {
	CreateTagRoute,
	CreateTagsRoute,
	GetTagDeleteImpactRoute,
	ListTagsRoute,
	ModifyTagRoute,
	RemoveTagRoute,
	ValidateTagsRoute,
} from "./types.js";

/** Registers authenticated Tags API routes. */
export const tagRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<ListTagsRoute>("/tags", listTagsHandler(database));

		app.post<ValidateTagsRoute>(
			"/validate-tags",
			validateTagsHandler(database),
		);

		// input: { title: string } | { title: string, color: string }
		app.post<CreateTagRoute>("/create-tag", createTagHandler(database));
		// input: [{ title: string } | { title: string, color: string }]
		app.post<CreateTagsRoute>("/create-tags", createTagsHandler(database));

		app.post<ModifyTagRoute>("/modify-tag", modifyTagHandler(database));

		app.get<GetTagDeleteImpactRoute>(
			"/tags/:id/delete-impact",
			getTagDeleteImpactHandler(database),
		);
		app.post<RemoveTagRoute>("/remove-tag", removeTagHandler(database));
	};
