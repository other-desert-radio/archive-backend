import type { FastifyReply, FastifyRequest } from "fastify";
import { MixcloudClientError } from "../../../../../mixcloud/index.js";
import type {
	MixcloudRouteDependencies,
	PrepareUploadedShowRoute,
} from "../../types.js";
import { loadUploadedShow, storeUploadedShowSnapshot } from "./upload-store.js";

/** Pending upload → fetch cloudcast → store snapshot → review fields. */
export const prepareUploadedShowHandler =
	(
		database: MixcloudRouteDependencies["database"],
		integration: MixcloudRouteDependencies["integration"],
	) =>
	async (
		request: FastifyRequest<PrepareUploadedShowRoute>,
		reply: FastifyReply<PrepareUploadedShowRoute>,
	) => {
		const startedAt = Date.now();
		const uploadId = Number(request.params.id);
		if (
			!/^[1-9]\d*$/.test(request.params.id) ||
			!Number.isSafeInteger(uploadId)
		)
			return reply.code(400).send({ error: "Invalid upload ID" });
		request.log.info({ uploadId }, "[Mixcloud Review] started");
		try {
			const upload = await loadUploadedShow(database, uploadId);
			if (!upload) return reply.code(404).send({ error: "Upload not found" });
			if (upload.show_id !== null)
				return reply
					.code(409)
					.send({ error: "This upload has already been saved" });
			if (!integration) {
				request.log.warn(
					{
						uploadId,
						statusCode: 503,
						reason: "integration_not_configured",
						elapsedMs: Date.now() - startedAt,
					},
					"[Mixcloud Review] preparation unavailable: Mixcloud integration is not configured",
				);
				return reply.code(503).send({ error: "Mixcloud is not configured" });
			}
			request.log.info(
				{ uploadId },
				"[Mixcloud Review] fetching provider metadata",
			);
			const cloudcast = await integration.client.getCloudcast(
				upload.mixcloud_key,
			);
			const prepared = await storeUploadedShowSnapshot(
				database,
				uploadId,
				cloudcast,
			);
			if (!prepared)
				return reply
					.code(409)
					.send({ error: "Upload changed while preparing review" });
			request.log.info(
				{ uploadId, elapsedMs: Date.now() - startedAt },
				"[Mixcloud Review] prepared",
			);
			return reply.code(200).send({
				uploadId,
				editorial: {
					title: prepared.title,
					description: prepared.description ?? "",
					date: prepared.date.toISOString().slice(0, 10),
					djs: prepared.djs,
				},
				mixcloud: cloudcast,
			});
		} catch (error) {
			if (error instanceof MixcloudClientError) {
				const statusCode = error.code === "cloudcast_timeout" ? 504 : 502;
				const explanations = {
					invalid_key: "Stored Mixcloud key is invalid",
					http_error: `Mixcloud API returned HTTP ${error.providerStatus}`,
					invalid_json: "Mixcloud returned unreadable JSON",
					invalid_metadata:
						"Mixcloud metadata is missing or has invalid required fields",
					key_mismatch: "Mixcloud returned metadata for a different show key",
					provider_error:
						"Mixcloud returned an error in a successful HTTP response",
					timeout: "Mixcloud metadata request timed out",
					network_error: "Could not reach Mixcloud to load metadata",
				};
				request.log.warn(
					{
						uploadId,
						reason: error.code,
						providerStatus: error.providerStatus,
						failureReason: error.failureReason,
						statusCode,
						elapsedMs: Date.now() - startedAt,
					},
					`[Mixcloud Review] ${error.failureReason ? explanations[error.failureReason] : "Could not fetch uploaded show metadata"}`,
				);
				return reply.code(statusCode).send({
					error: "Uploaded to Mixcloud, but we were unable to fetch the show.",
				});
			}
			request.log.error(
				{
					uploadId,
					statusCode: 500,
					reason: "preparation_failed",
					elapsedMs: Date.now() - startedAt,
				},
				"[Mixcloud Review] preparation failed",
			);
			return reply.code(500).send({ error: "Unable to prepare uploaded show" });
		}
	};
