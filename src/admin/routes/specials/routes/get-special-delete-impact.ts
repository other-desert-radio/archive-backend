import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { isDatabaseId } from "../../../../utils/index.js";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import {
	type GetSpecialDeleteImpactRoute,
	RemoveSpecialRequestPattern,
} from "../types.js";

export const getSpecialDeleteImpactHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<GetSpecialDeleteImpactRoute>,
		reply: FastifyReply<GetSpecialDeleteImpactRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[Special Deletion Preview] started",
		);
		const rawId = request.params.id;
		const id = Number(rawId);
		if (
			!/^[0-9]+$/.test(rawId) ||
			!isMatching(RemoveSpecialRequestPattern, { id })
		) {
			request.log.warn("[Special Deletion Preview] rejected -- invalid ID");
			return reply.code(400).send({ error: "Validation error" });
		}
		try {
			const special = !isDatabaseId(id)
				? undefined
				: await database
						.selectFrom("specials")
						.select(["id", "title"])
						.where("id", "=", id)
						.executeTakeFirst();
			if (special === undefined) {
				request.log.warn(
					`[Special Deletion Preview] rejected -- Special not found, id: ${id}`,
				);
				return reply.code(404).send({ error: "Not Found" });
			}
			const shows = await database
				.selectFrom("shows")
				.select(["id", "title"])
				.where("special_id", "=", id)
				.execute();
			shows.sort(
				(left, right) =>
					left.title.localeCompare(right.title) || left.id - right.id,
			);
			request.log.info(
				`[Special Deletion Preview] loaded -- id: ${id}, Shows: ${shows.length}`,
			);
			return { special, shows };
		} catch (error) {
			request.log.error(
				{ err: error },
				`[Special Deletion Preview] failed -- id: ${id}`,
			);
			return reply.code(500).send({
				error: "Unable to load Special deletion preview. Please try again.",
			});
		}
	};
