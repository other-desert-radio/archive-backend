import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import { loadTagDeleteImpact } from "../delete-impact.js";
import type { GetTagDeleteImpactRoute } from "../types.js";
import { RemoveTagRequestPattern } from "../types.js";

export const getTagDeleteImpactHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<GetTagDeleteImpactRoute>,
		reply: FastifyReply<GetTagDeleteImpactRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[Tag Deletion Preview] started",
		);
		const rawId = request.params.id;
		const id = Number(rawId);
		if (
			!/^[0-9]+$/.test(rawId) ||
			!isMatching(RemoveTagRequestPattern, { id })
		) {
			request.log.warn("[Tag Deletion Preview] rejected -- invalid ID");
			return reply.code(400).send({ error: "Validation error" });
		}
		try {
			const impact = await loadTagDeleteImpact(database, id);
			if (impact === undefined) {
				request.log.warn(
					`[Tag Deletion Preview] rejected -- tag not found, id: ${id}`,
				);
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info(
				`[Tag Deletion Preview] loaded -- id: ${id}, Shows: ${impact.shows.length}, DJs: ${impact.djs.length}`,
			);
			return impact;
		} catch (error) {
			request.log.error(
				{ err: error },
				`[Tag Deletion Preview] failed -- id: ${id}`,
			);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
