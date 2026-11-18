import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import type { TypedDatabase } from "../../types.js";
import type { CreateSpecialRoute } from "../types.js";
export const createSpecialHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<CreateSpecialRoute>,
		reply: FastifyReply<CreateSpecialRoute>,
	) => {
		request.log.info("[Special Creation] started");
		if (!isMatching({ title: P.string }, request.body)) {
			request.log.warn("[Special Creation] rejected -- invalid request");
			return reply.code(400).send({ error: "Validation error" });
		}
		const normalized = { title: request.body.title.trim() };
		if (!isMatching({ title: P.string.minLength(1) }, normalized)) {
			request.log.warn("[Special Creation] rejected -- blank title");
			return reply.code(400).send({ error: "Name is required" });
		}
		try {
			const row = await database
				.insertInto("specials")
				.values(normalized)
				.returningAll()
				.executeTakeFirstOrThrow();
			request.log.info({ id: row.id }, "[Special Creation] created");
			return reply
				.code(201)
				.send({ ...row, createdAt: row.createdAt.toISOString() });
		} catch (error) {
			request.log.error({ err: error }, "[Special Creation] failed");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
