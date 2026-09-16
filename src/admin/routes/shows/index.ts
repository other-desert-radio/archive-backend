import type { FastifyPluginAsync } from "fastify";
import type { ShowsJSON } from "../../../json-transformers/index.js";
import { transformShows } from "../../../json-transformers/index.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";

/** Registers authenticated Shows API routes. */
export const showRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<{ Reply: AdminApiReply<ShowsJSON[]> }>(
			"/shows",
			async (request, reply) => {
				try {
					const [shows, showDJs, showTags] = await Promise.all([
						database
							.selectFrom("shows")
							.select(["id", "title", "date", "duration", "image", "url"])
							.orderBy("id")
							.execute(),
						database
							.selectFrom("show_djs")
							.select(["show_id", "dj_id"])
							.orderBy("show_id")
							.orderBy("dj_id")
							.execute(),
						database
							.selectFrom("show_tags")
							.select(["show_id", "tag_id"])
							.orderBy("show_id")
							.orderBy("tag_id")
							.execute(),
					]);

					return transformShows({ shows, showDJs, showTags });
				} catch (error) {
					request.log.error(error, "Unable to load shows");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);
	};
