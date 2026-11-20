import type { FastifyReply, FastifyRequest } from "fastify";
import { transformShows } from "../../../../json-transformers/index.js";
import { sanitizeArchiveHtml } from "../../../../utils/sanitize-html.js";
import type { TypedDatabase } from "../../types.js";
import type { ListShowsRoute } from "../types.js";

export const listShowsHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ListShowsRoute>,
		reply: FastifyReply<ListShowsRoute>,
	) => {
		try {
			const [shows, showDJs, showTags, specials] = await Promise.all([
				database
					.selectFrom("shows")
					.select([
						"id",
						"createdAt",
						"title",
						"description",
						"tracklist",
						"special_id",
						"date",
						"duration",
						"mixcloud_image_small",
						"mixcloud_image_large",
						"url",
					])
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
				database.selectFrom("specials").select(["id", "title"]).execute(),
			]);

			const specialsById = new Map(
				specials.map((special) => [special.id, special]),
			);
			const rowsByShowId = new Map(shows.map((show) => [show.id, show]));
			return transformShows({ shows, showDJs, showTags }).map((show) => {
				const row = rowsByShowId.get(show.id);
				if (row === undefined) {
					throw new Error(`Show ${show.id} is missing its creation timestamp`);
				}
				const special =
					row.special_id == null ? undefined : specialsById.get(row.special_id);
				return {
					...(special === undefined ? {} : { special }),
					...show,
					createdAt: row.createdAt,
					tracklist: row.tracklist,
					...(row.description == null
						? {}
						: { description: sanitizeArchiveHtml(row.description) }),
					mixcloud_image_small: row.mixcloud_image_small,
					mixcloud_image_large: row.mixcloud_image_large,
				};
			});
		} catch (error) {
			request.log.error(error, "Unable to load shows");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
