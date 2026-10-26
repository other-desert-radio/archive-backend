import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import { normalizeCreateShowRequest } from "../normalize-create-show-request.js";
import { saveShow } from "../save-show.js";
import type { ModifyShowRoute } from "../types.js";
import { ModifyShowRequestPattern } from "../types.js";

export const modifyShowHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ModifyShowRoute>,
		reply: FastifyReply<ModifyShowRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[Show Editing] started",
		);
		if (!isMatching(ModifyShowRequestPattern, request.body)) {
			request.log.warn("[Show Editing] rejected -- invalid request shape");
			return reply.code(400).send({ error: "Validation error" });
		}
		const id = request.body.id;
		try {
			const normalized = normalizeCreateShowRequest(request.body);
			const modified = await saveShow(database, normalized, id);
			if (modified === undefined) {
				request.log.warn(
					{ showId: id },
					`[Show Editing] rejected -- Show ${id} not found`,
				);
				return reply.code(404).send({ error: "Not Found" });
			}
			request.log.info(
				{ showId: id, client: clientDescription(request) },
				`[Show Editing] Show saved -- id: ${id}, title: ${modified.title}`,
			);
			return reply.code(200).send(modified);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Internal Server Error";
			if (
				message === "Validation error" ||
				message === "One or more selected DJs do not exist"
			) {
				request.log.warn(
					{ showId: id, reason: message },
					`[Show Editing] rejected -- id: ${id}, reason: ${message}`,
				);
				return reply.code(400).send({ error: message });
			}
			request.log.error(
				{ err: error, showId: id },
				`[Show Editing] failed -- id: ${id}`,
			);
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
