import type { FastifyPluginAsync } from "fastify";
import type { DJJSON } from "../../../json-transformers/index.js";
import { transformDJs } from "../../../json-transformers/index.js";
import type { AdminApiReply, TypedDatabase } from "../types.js";

/** Registers authenticated DJ API routes. */
export const djRoutes =
	(database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.get<{ Reply: AdminApiReply<DJJSON[]> }>(
			"/djs",
			async (request, reply) => {
				try {
					const [djs, showDJs, djTags, showTags] = await Promise.all([
						database
							.selectFrom("djs")
							.select(["id", "title", "bio", "image", "socials"])
							.orderBy("id")
							.execute(),
						database
							.selectFrom("show_djs")
							.select(["dj_id", "show_id"])
							.orderBy("dj_id")
							.orderBy("show_id")
							.execute(),
						database
							.selectFrom("dj_tags")
							.select(["dj_id", "tag_id"])
							.orderBy("dj_id")
							.orderBy("tag_id")
							.execute(),
						database
							.selectFrom("show_djs")
							.innerJoin("show_tags", "show_tags.show_id", "show_djs.show_id")
							.select(["show_djs.dj_id", "show_tags.tag_id"])
							.orderBy("show_djs.dj_id")
							.orderBy("show_tags.tag_id")
							.execute(),
					]);

					return transformDJs({ djs, showDJs, djTags, showTags });
				} catch (error) {
					request.log.error(error, "Unable to load DJs");
					return reply.code(500).send({ error: "Internal Server Error" });
				}
			},
		);

		app.post<{ Reply: undefined }>("/create-dj", async () => {
			// 1. validate body
			// 2. validat tags -> insert invalid tags into table
			//    TODO: add new tags field: reviewed? true if created, false if auto generated
			// 3. insert into DJ table
			return undefined;
		});
	};
