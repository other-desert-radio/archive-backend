import type { FastifyReply, FastifyRequest } from "fastify";
import { readPublicationStatus } from "../../../../publication/index.js";
import type {
	PublicationRouteDependencies,
	PublicationStatusRoute,
} from "../types.js";

export const getPublicationStatusHandler =
	(
		database: PublicationRouteDependencies["database"],
		config: PublicationRouteDependencies["config"],
	) =>
	async (
		request: FastifyRequest<PublicationStatusRoute>,
		reply: FastifyReply<PublicationStatusRoute>,
	) => {
		try {
			return await readPublicationStatus(database, config);
		} catch (error) {
			request.log.error({ err: error }, "[Publication] status read failed");
			return reply.code(500).send({
				error: `Could not load publication status. Reload status to try again. Request ID: ${request.id}.`,
			});
		}
	};
