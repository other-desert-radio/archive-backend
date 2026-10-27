import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import {
	type MixcloudRouteDependencies,
	ReviewedUploadFieldsPattern,
	type SaveUploadedShowRoute,
} from "../../types.js";
import { saveReviewedUpload } from "./upload-store.js";

/** Reviewed editorial fields + stored provider snapshot → atomic Show save. */
export const saveUploadedShowHandler =
	(database: MixcloudRouteDependencies["database"]) =>
	async (
		request: FastifyRequest<SaveUploadedShowRoute>,
		reply: FastifyReply<SaveUploadedShowRoute>,
	) => {
		const startedAt = Date.now();
		const uploadId = Number(request.params.id);
		if (
			!/^[1-9]\d*$/.test(request.params.id) ||
			!Number.isSafeInteger(uploadId) ||
			!isMatching(ReviewedUploadFieldsPattern, request.body)
		) {
			request.log.warn("[Uploaded Show Save] rejected -- invalid input");
			return reply.code(400).send({ error: "Validation error" });
		}
		request.log.info({ uploadId }, "[Uploaded Show Save] started");
		try {
			const result = await saveReviewedUpload(database, uploadId, request.body);
			if (!result) return reply.code(404).send({ error: "Upload not found" });
			request.log.info(
				{
					uploadId,
					showId: result.show.id,
					created: result.created,
					elapsedMs: Date.now() - startedAt,
				},
				"[Uploaded Show Save] completed",
			);
			return reply.code(result.created ? 201 : 200).send({ show: result.show });
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (message === "Prepare Mixcloud metadata before saving") {
				request.log.warn(
					{ uploadId },
					"[Uploaded Show Save] rejected -- metadata not prepared",
				);
				return reply.code(409).send({ error: message });
			}
			if (
				message === "Validation error" ||
				message === "One or more selected DJs do not exist"
			) {
				request.log.warn(
					{ uploadId },
					"[Uploaded Show Save] rejected -- invalid fields or DJs",
				);
				return reply.code(400).send({ error: message });
			}
			request.log.error(
				{ uploadId },
				"[Uploaded Show Save] transaction failed",
			);
			return reply.code(500).send({ error: "Unable to save uploaded show" });
		}
	};
