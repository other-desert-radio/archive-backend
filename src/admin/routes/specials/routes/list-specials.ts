import type { FastifyReply, FastifyRequest } from "fastify";
import type { TypedDatabase } from "../../types.js";
import type { ListSpecialsRoute } from "../types.js";
export const listSpecialsHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ListSpecialsRoute>,
		reply: FastifyReply<ListSpecialsRoute>,
	) => {
		request.log.info("[Special Listing] started");
		try {
			const rows = await database
				.selectFrom("specials")
				.selectAll()
				.orderBy("id")
				.execute();
			request.log.info({ count: rows.length }, "[Special Listing] loaded");
			return rows.map((row) => ({
				...row,
				description: row.description ?? undefined,
				createdAt: row.createdAt.toISOString(),
			}));
		} catch (error) {
			request.log.error({ err: error }, "[Special Listing] failed");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
