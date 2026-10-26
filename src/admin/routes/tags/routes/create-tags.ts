import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import type { TypedDatabase } from "../../types.js";
import { createTags } from "../tag-service.js";
import type { CreateTagsRoute } from "../types.js";
import { CreateTagsRequestPattern } from "../types.js";

export const createTagsHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<CreateTagsRoute>,
		reply: FastifyReply<CreateTagsRoute>,
	) => {
		if (!isMatching(CreateTagsRequestPattern, request.body)) {
			return reply.code(400).send({ error: "Validation error" });
		}

		try {
			return reply.code(201).send(await createTags(database, request.body));
		} catch (error) {
			request.log.error(error, "Unable to create tags");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
