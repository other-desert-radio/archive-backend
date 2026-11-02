import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import { isDatabaseId } from "../../../../utils/index.js";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import type { RemoveShowRoute } from "../types.js";

export const RemoveShowRequestPattern = {
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
} as const;

export const removeShowHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<RemoveShowRoute>,
		reply: FastifyReply<RemoveShowRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[Show Deletion] started",
		);
		if (!isMatching(RemoveShowRequestPattern, request.body)) {
			request.log.warn("[Show Deletion] rejected -- invalid request shape");
			return reply.code(400).send({ error: "Validation error" });
		}
		const { id } = request.body;
		try {
			const removed = !isDatabaseId(id)
				? undefined
				: await database.transaction().execute(async (transaction) => {
						// Remove completed upload tracking so deletion does not reopen Pending uploads.
						await transaction
							.deleteFrom("mixcloud_uploads")
							.where("show_id", "=", id)
							.execute();
						return transaction
							.deleteFrom("shows")
							.where("id", "=", id)
							.returning("id")
							.executeTakeFirst();
					});
			if (removed === undefined) {
				request.log.warn(
					`[Show Deletion] rejected -- show not found, id: ${id}`,
				);
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info(
				{ client: clientDescription(request) },
				`[Show Deletion] deleted -- id: ${id}`,
			);
			return removed;
		} catch (error) {
			request.log.error({ err: error }, `[Show Deletion] failed -- id: ${id}`);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
