import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import { readPublicationJob } from "../../../../publication/index.js";
import type {
	PublicationJobRoute,
	PublicationRouteDependencies,
} from "../types.js";

export const getPublicationJobHandler =
	(database: PublicationRouteDependencies["database"]) =>
	async (
		request: FastifyRequest<PublicationJobRoute>,
		reply: FastifyReply<PublicationJobRoute>,
	) => {
		if (
			!isMatching(
				P.string.regex(
					/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
				),
				request.params.jobId,
			)
		)
			return reply.code(400).send({ error: "Invalid job ID" });
		try {
			const detail = await readPublicationJob(database, request.params.jobId);
			return detail === undefined
				? reply.code(404).send({ error: "Not Found" })
				: detail;
		} catch (error) {
			request.log.error({ err: error }, "[Publication] job read failed");
			return reply.code(500).send({
				error: `Could not load the publication job and logs. Reload status to try again. Request ID: ${request.id}.`,
			});
		}
	};
