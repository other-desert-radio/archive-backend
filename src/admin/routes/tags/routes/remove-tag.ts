import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { isDatabaseId } from "../../../../utils/index.js";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import type { RemoveTagRoute } from "../types.js";
import { RemoveTagRequestPattern } from "../types.js";

export const removeTagHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<RemoveTagRoute>,
		reply: FastifyReply<RemoveTagRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[Tag Deletion] started",
		);
		if (!isMatching(RemoveTagRequestPattern, request.body)) {
			request.log.warn("[Tag Deletion] rejected -- invalid request shape");
			return reply.code(400).send({ error: "Validation error" });
		}
		const { id } = request.body;
		try {
			const removed = !isDatabaseId(id)
				? undefined
				: await database
						.deleteFrom("tags")
						.where("id", "=", id)
						.returning("id")
						.executeTakeFirst();
			if (removed === undefined) {
				request.log.warn(`[Tag Deletion] rejected -- tag not found, id: ${id}`);
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info(
				{ client: clientDescription(request) },
				`[Tag Deletion] deleted -- id: ${id}`,
			);
			return removed;
		} catch (error) {
			request.log.error({ err: error }, `[Tag Deletion] failed -- id: ${id}`);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
