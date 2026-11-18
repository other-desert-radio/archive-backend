import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { isDatabaseId } from "../../../../utils/index.js";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import {
	RemoveSpecialRequestPattern,
	type RemoveSpecialRoute,
} from "../types.js";

export const removeSpecialHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<RemoveSpecialRoute>,
		reply: FastifyReply<RemoveSpecialRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[Special Deletion] started",
		);
		if (!isMatching(RemoveSpecialRequestPattern, request.body)) {
			request.log.warn("[Special Deletion] rejected -- invalid request shape");
			return reply.code(400).send({ error: "Validation error" });
		}
		const { id } = request.body;
		try {
			const removed = !isDatabaseId(id)
				? undefined
				: await database
						.deleteFrom("specials")
						.where("id", "=", id)
						.returning("id")
						.executeTakeFirst();
			if (removed === undefined) {
				request.log.warn(
					`[Special Deletion] rejected -- Special not found, id: ${id}`,
				);
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info(
				{ client: clientDescription(request) },
				`[Special Deletion] deleted -- id: ${id}`,
			);
			return removed;
		} catch (error) {
			if (
				isMatching(
					{ code: "23503", constraint: "shows_special_id_fkey" },
					error,
				)
			) {
				request.log.warn(
					`[Special Deletion] rejected -- linked Shows, id: ${id}`,
				);
				return reply.code(409).send({
					error:
						"Remove this Special from all Shows or delete those Shows before deleting the Special.",
				});
			}
			request.log.error(
				{ err: error },
				`[Special Deletion] failed -- id: ${id}`,
			);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
