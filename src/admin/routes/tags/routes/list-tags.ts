import type { FastifyReply, FastifyRequest } from "fastify";
import { transformTags } from "../../../../json-transformers/index.js";
import type { TypedDatabase } from "../../types.js";
import type { ListTagsRoute } from "../types.js";

export const listTagsHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ListTagsRoute>,
		reply: FastifyReply<ListTagsRoute>,
	) => {
		try {
			const tags = await database
				.selectFrom("tags")
				.select([
					"id",
					"createdAt",
					"title",
					"color",
					"reviewed",
					"mixcloud_key",
					"mixcloud_url",
				])
				.orderBy("id")
				.execute();

			return transformTags({ tags });
		} catch (error) {
			request.log.error(error, "Unable to load tags");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
