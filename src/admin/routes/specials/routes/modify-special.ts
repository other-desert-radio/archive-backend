import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import type { TypedDatabase } from "../../types.js";
import type { ModifySpecialRoute } from "../types.js";

export const modifySpecialHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ModifySpecialRoute>,
		reply: FastifyReply<ModifySpecialRoute>,
	) => {
		request.log.info("[Special Editing] started");
		if (
			!isMatching(
				{ id: P.number.int().between(1, 2_147_483_647), title: P.string },
				request.body,
			) ||
			!request.body.title.trim()
		) {
			request.log.warn("[Special Editing] rejected -- invalid ID or name");
			return reply
				.code(400)
				.send({ error: "A valid ID and name are required" });
		}
		const { id, title } = request.body;
		try {
			const row = await database
				.updateTable("specials")
				.set({ title: title.trim() })
				.where("id", "=", id)
				.returningAll()
				.executeTakeFirst();
			if (!row) {
				request.log.warn({ id }, "[Special Editing] rejected -- not found");
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info({ id }, "[Special Editing] saved");
			return reply
				.code(200)
				.send({ ...row, createdAt: row.createdAt.toISOString() });
		} catch (error) {
			request.log.error({ err: error, id }, "[Special Editing] failed");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
