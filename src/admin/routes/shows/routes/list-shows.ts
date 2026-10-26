import type { FastifyReply, FastifyRequest } from "fastify";
import { sql } from "kysely";
import { transformShows } from "../../../../json-transformers/index.js";
import type { TypedDatabase } from "../../types.js";
import type { ListShowsRoute } from "../types.js";

export const listShowsHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ListShowsRoute>,
		reply: FastifyReply<ListShowsRoute>,
	) => {
		try {
			const [shows, showDJs, showTags] = await Promise.all([
				database
					.selectFrom("shows")
					.select([
						"id",
						"createdAt",
						"title",
						"description",
						"date",
						"duration",
						"mixcloud_image_small",
						"mixcloud_image_large",
						sql<boolean>`image_small is not null and image_large is not null`.as(
							"has_images",
						),
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
			]);

			const rowsByShowId = new Map(shows.map((show) => [show.id, show]));
			return transformShows({ shows, showDJs, showTags }).map((show) => {
				const row = rowsByShowId.get(show.id);
				if (row === undefined) {
					throw new Error(`Show ${show.id} is missing its creation timestamp`);
				}
				return {
					...show,
					createdAt: row.createdAt,
					...(row.description == null ? {} : { description: row.description }),
					...(row.has_images
						? {
								image_small: `/api/admin/shows/${row.id}/image/small`,
								image_large: `/api/admin/shows/${row.id}/image/large`,
							}
						: {}),
					mixcloud_image_small: row.mixcloud_image_small,
					mixcloud_image_large: row.mixcloud_image_large,
				};
			});
		} catch (error) {
			request.log.error(error, "Unable to load shows");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
