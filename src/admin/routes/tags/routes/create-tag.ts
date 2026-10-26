import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import type { TypedDatabase } from "../../types.js";
import { createTag } from "../tag-service.js";
import type { CreateTagRoute } from "../types.js";
import { CreateTagRequestPattern } from "../types.js";

export const createTagHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<CreateTagRoute>,
		reply: FastifyReply<CreateTagRoute>,
	) => {
		if (!isMatching(CreateTagRequestPattern, request.body)) {
			return reply.code(400).send({ error: "Validation error" });
		}

		try {
			return reply.code(201).send(await createTag(database, request.body));
		} catch (error) {
			request.log.error(error, "Unable to create tag");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
