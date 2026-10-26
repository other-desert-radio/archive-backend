import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { clientDescription } from "../../../logging.js";
import type { TypedDatabase } from "../../types.js";
import { importShow } from "../import-show.js";
import { normalizeCreateShowRequest } from "../normalize-create-show-request.js";
import { saveShow } from "../save-show.js";
import type { CreateShowRoute } from "../types.js";
import { CreateShowRequestPattern } from "../types.js";

export const createShowHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<CreateShowRoute>,
		reply: FastifyReply<CreateShowRoute>,
	) => {
		request.log.info(
			{ client: clientDescription(request) },
			"[Show Creation] started",
		);
		if (!isMatching(CreateShowRequestPattern, request.body)) {
			request.log.warn("[Show Creation] rejected -- invalid request shape");
			return reply.code(400).send({ error: "Validation error" });
		}
		try {
			const normalized = normalizeCreateShowRequest(request.body);
			if (request.body.mixcloud_import_id !== undefined) {
				const importId = request.body.mixcloud_import_id;
				request.log.info(`[Show Import] started -- tracking row: ${importId}`);
				const result = await importShow(database, normalized, importId);
				if (result === undefined) {
					request.log.warn(
						`[Show Import] rejected -- tracking row ${importId} not found`,
					);
					return reply.code(404).send({ error: "Not Found" });
				}
				request.log.info(
					{
						importId,
						showId: result.show.id,
						client: clientDescription(request),
					},
					`[Show Import] ${result.created ? "created" : "already imported"} -- tracking row: ${importId}, Show: ${result.show.id}`,
				);
				return reply.code(result.created ? 201 : 200).send(result.show);
			}
			const created = await saveShow(database, normalized);
			if (created === undefined) throw new Error("Show creation failed");
			request.log.info(
				{ showId: created.id, client: clientDescription(request) },
				`[Show Creation] Show created -- id: ${created.id}, title: ${created.title}`,
			);
			return reply.code(201).send(created);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Internal Server Error";
			if (
				message === "Validation error" ||
				message === "One or more selected DJs do not exist"
			) {
				request.log.warn({ reason: message }, "[Show Creation] rejected");
				return reply.code(400).send({ error: message });
			}
			request.log.error({ err: error }, "[Show Creation] failed");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
