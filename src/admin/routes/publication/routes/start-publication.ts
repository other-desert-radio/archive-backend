import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import { AccountError, getAccountSession } from "../../../../auth/access.js";
import {
	PublicationBusyError,
	PublicationRequestError,
	readPublicationJob,
} from "../../../../publication/index.js";
import { uuidPattern } from "../request-patterns.js";
import type {
	PublicationRouteDependencies,
	PublicationStartRoute,
} from "../types.js";

export const startPublicationHandler =
	(
		auth: PublicationRouteDependencies["auth"],
		database: PublicationRouteDependencies["database"],
		config: PublicationRouteDependencies["config"],
		runner: PublicationRouteDependencies["runner"],
	) =>
	async (
		request: FastifyRequest<PublicationStartRoute>,
		reply: FastifyReply<PublicationStartRoute>,
	) => {
		const body: unknown = request.body ?? {};
		if (
			Array.isArray(body) ||
			!isMatching(
				{
					previewId: P.optional(uuidPattern),
					retryJobId: P.optional(
						P.string.regex(
							/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
						),
					),
				},
				body,
			) ||
			Object.keys(body).some(
				(key) => key !== "retryJobId" && key !== "previewId",
			)
		)
			return reply.code(400).send({ error: "Invalid publication request" });
		try {
			const session = await getAccountSession(auth, request);
			if (body.retryJobId !== undefined) {
				const detail = await readPublicationJob(database, body.retryJobId);
				if (detail === undefined)
					return reply.code(404).send({ error: "Retry job not found" });
				if (
					detail.job.outcome !== "failed" &&
					detail.job.outcome !== "interrupted"
				)
					return reply.code(409).send({
						error: "Only failed or interrupted jobs can be retried",
					});
			}
			const job = await runner.start({
				requestedBy: session.user.id,
				...(body.previewId === undefined ? {} : { previewId: body.previewId }),
				...(body.retryJobId === undefined
					? {}
					: { retryJobId: body.retryJobId }),
			});
			request.log.info(
				{ jobId: job.id },
				`[Publication] job started -- id: ${job.id}, mode: ${config.mode}, branch: ${job.target.branch ?? "none"}`,
			);
			return reply.code(202).send(job);
		} catch (error) {
			if (error instanceof PublicationRequestError) {
				request.log.warn(
					{ statusCode: error.statusCode },
					"[Publication] start rejected -- invalid state",
				);
				return reply.code(error.statusCode).send({ error: error.message });
			}
			if (error instanceof PublicationBusyError) {
				request.log.warn(
					"[Publication] start rejected -- another job is running",
				);
				return reply.code(409).send({ error: error.message });
			}
			if (error instanceof AccountError)
				return reply
					.code(error.status === 401 ? 401 : 403)
					.send({ error: error.message });
			request.log.error({ err: error }, "[Publication] start failed");
			return reply.code(500).send({
				error: `Could not start publication. Reload status to check whether a job was created before retrying. Request ID: ${request.id}.`,
			});
		}
	};
