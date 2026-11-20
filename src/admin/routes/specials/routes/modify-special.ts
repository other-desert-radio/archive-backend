import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import { plainTextToSafeHtml } from "../../../../utils/plain-text-to-safe-html.js";
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
				{
					id: P.number.int().between(1, 2_147_483_647),
					title: P.string,
					description: P.optional(P.string),
				},
				request.body,
			) ||
			!request.body.title.trim()
		) {
			request.log.warn("[Special Editing] rejected -- invalid ID or name");
			return reply
				.code(400)
				.send({ error: "A valid ID and name are required" });
		}
		const { id, title, description } = request.body;
		try {
			const row = await database
				.updateTable("specials")
				.set({
					title: title.trim(),
					...(description === undefined
						? {}
						: {
								description: description.trim()
									? plainTextToSafeHtml(description.trim())
									: null,
							}),
				})
				.where("id", "=", id)
				.returningAll()
				.executeTakeFirst();
			if (!row) {
				request.log.warn({ id }, "[Special Editing] rejected -- not found");
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info({ id }, "[Special Editing] saved");
			return reply.code(200).send({
				...row,
				description: row.description ?? undefined,
				createdAt: row.createdAt.toISOString(),
			});
		} catch (error) {
			request.log.error({ err: error, id }, "[Special Editing] failed");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
