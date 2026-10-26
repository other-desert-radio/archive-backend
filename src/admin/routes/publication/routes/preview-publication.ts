import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { AccountError, getAccountSession } from "../../../../auth/access.js";
import {
	PublicationBusyError,
	PublicationRequestError,
	readPublicationJob,
} from "../../../../publication/index.js";
import { previewRequestPattern } from "../request-patterns.js";
import type {
	PublicationPreviewRoute,
	PublicationRouteDependencies,
} from "../types.js";

export const previewPublicationHandler =
	(
		auth: PublicationRouteDependencies["auth"],
		database: PublicationRouteDependencies["database"],
		runner: PublicationRouteDependencies["runner"],
	) =>
	async (
		request: FastifyRequest<PublicationPreviewRoute>,
		reply: FastifyReply<PublicationPreviewRoute>,
	) => {
		reply.header("Cache-Control", "private, no-store");
		const body: unknown = request.body ?? {};
		if (
			Array.isArray(body) ||
			!isMatching(previewRequestPattern, body) ||
			Object.keys(body).some((key) => key !== "retryJobId")
		) {
			request.log.warn(
				"[Publication Preview] preparation rejected -- invalid request",
			);
			return reply
				.code(400)
				.send({ error: "Invalid publication preview request" });
		}
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
			request.log.info("[Publication Preview] preparation started");
			const preview = await runner.preparePreview({
				requestedBy: session.user.id,
				...(body.retryJobId === undefined
					? {}
					: { retryJobId: body.retryJobId }),
			});
			request.log.info(
				{ previewId: preview.id },
				`[Publication Preview] preparation completed -- id: ${preview.id}`,
			);
			return reply.code(200).send(preview);
		} catch (error) {
			if (error instanceof PublicationRequestError) {
				request.log.warn(
					{ statusCode: error.statusCode },
					"[Publication Preview] preparation rejected -- invalid state",
				);
				return reply.code(error.statusCode).send({ error: error.message });
			}
			if (error instanceof PublicationBusyError)
				return reply.code(409).send({ error: error.message });
			if (error instanceof AccountError)
				return reply
					.code(error.status === 401 ? 401 : 403)
					.send({ error: error.message });
			request.log.error(
				{ err: error },
				"[Publication Preview] preparation failed",
			);
			return reply.code(500).send({
				error: `Could not prepare publication changes. Retry the preview. Request ID: ${request.id}.`,
			});
		}
	};
