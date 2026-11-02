import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { isDatabaseId } from "../../../../utils/index.js";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import {
	type GetDJDeleteImpactRoute,
	RemoveDJRequestPattern,
} from "../types.js";

export const getDJDeleteImpactHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<GetDJDeleteImpactRoute>,
		reply: FastifyReply<GetDJDeleteImpactRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[DJ Deletion Preview] started",
		);
		const rawId = request.params.id;
		const id = Number(rawId);
		if (
			!/^[0-9]+$/.test(rawId) ||
			!isMatching(RemoveDJRequestPattern, { id })
		) {
			request.log.warn("[DJ Deletion Preview] rejected -- invalid ID");
			return reply.code(400).send({ error: "Validation error" });
		}
		try {
			const dj = !isDatabaseId(id)
				? undefined
				: await database
						.selectFrom("djs")
						.select(["id", "title"])
						.where("id", "=", id)
						.executeTakeFirst();
			if (dj === undefined) {
				request.log.warn(
					`[DJ Deletion Preview] rejected -- DJ not found, id: ${id}`,
				);
				return reply.code(404).send({ error: "Not Found" });
			}
			const shows = await database
				.selectFrom("show_djs")
				.innerJoin("shows", "shows.id", "show_djs.show_id")
				.select(["shows.id", "shows.title"])
				.where("show_djs.dj_id", "=", id)
				.execute();
			shows.sort(
				(left, right) =>
					left.title.localeCompare(right.title) || left.id - right.id,
			);
			request.log.info(
				`[DJ Deletion Preview] loaded -- id: ${id}, Shows: ${shows.length}`,
			);
			return { dj, shows };
		} catch (error) {
			request.log.error(
				{ err: error },
				`[DJ Deletion Preview] failed -- id: ${id}`,
			);
			const detail = error instanceof Error ? error.message.trim() : "";
			return reply.code(500).send({
				error: `Unable to load DJ deletion preview. ${detail || "Please try again."}`,
			});
		}
	};
