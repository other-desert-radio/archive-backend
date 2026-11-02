import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { isDatabaseId } from "../../../../utils/index.js";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import { RemoveDJRequestPattern, type RemoveDJRoute } from "../types.js";

export const removeDJHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<RemoveDJRoute>,
		reply: FastifyReply<RemoveDJRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[DJ Deletion] started",
		);
		if (!isMatching(RemoveDJRequestPattern, request.body)) {
			request.log.warn("[DJ Deletion] rejected -- invalid request shape");
			return reply.code(400).send({ error: "Validation error" });
		}
		const { id } = request.body;
		try {
			const removed = !isDatabaseId(id)
				? undefined
				: await database
						.deleteFrom("djs")
						.where("id", "=", id)
						.returning("id")
						.executeTakeFirst();
			if (removed === undefined) {
				request.log.warn(`[DJ Deletion] rejected -- DJ not found, id: ${id}`);
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info(
				{ client: clientDescription(request) },
				`[DJ Deletion] deleted -- id: ${id}`,
			);
			return removed;
		} catch (error) {
			if (
				isMatching({ code: "23503", constraint: "show_djs_dj_id_fkey" }, error)
			) {
				request.log.warn(`[DJ Deletion] rejected -- linked Shows, id: ${id}`);
				return reply.code(409).send({
					error:
						"Remove this DJ from all Shows or delete those Shows before deleting the DJ.",
				});
			}
			request.log.error({ err: error }, `[DJ Deletion] failed -- id: ${id}`);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
