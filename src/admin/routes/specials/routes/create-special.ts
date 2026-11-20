import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import { plainTextToSafeHtml } from "../../../../utils/plain-text-to-safe-html.js";
import type { TypedDatabase } from "../../types.js";
import type { CreateSpecialRoute } from "../types.js";
export const createSpecialHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<CreateSpecialRoute>,
		reply: FastifyReply<CreateSpecialRoute>,
	) => {
		request.log.info("[Special Creation] started");
		if (
			!isMatching(
				{ title: P.string, description: P.optional(P.string) },
				request.body,
			)
		) {
			request.log.warn("[Special Creation] rejected -- invalid request");
			return reply.code(400).send({ error: "Validation error" });
		}
		const description = request.body.description?.trim();
		const normalized = {
			title: request.body.title.trim(),
			description: description ? plainTextToSafeHtml(description) : null,
		};
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
			return reply.code(201).send({
				...row,
				description: row.description ?? undefined,
				createdAt: row.createdAt.toISOString(),
			});
		} catch (error) {
			request.log.error({ err: error }, "[Special Creation] failed");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
