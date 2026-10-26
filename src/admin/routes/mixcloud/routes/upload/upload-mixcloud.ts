import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import { AccountError, getAccountSession } from "../../../../../auth/access.js";
import { sendFailure } from "../../send-failure.js";
import type {
	MixcloudRouteDependencies,
	UploadMixcloudRoute,
} from "../../types.js";
import { receiveUpload } from "./receive-upload.js";

/** The route owns auth and temporary files; provider transport lives in src/mixcloud/upload.ts. */
export const uploadMixcloudHandler =
	(
		auth: MixcloudRouteDependencies["auth"],
		integration: MixcloudRouteDependencies["integration"],
	) =>
	async (
		request: FastifyRequest<UploadMixcloudRoute>,
		reply: FastifyReply<UploadMixcloudRoute>,
	) => {
		const startedAt = Date.now();
		let directory: string | undefined;
		let status: 200 | 400 | 403 | 413 | 429 | 500 | 502 | 503 | 504 = 500;
		let success = false;
		try {
			if (!integration) return reply.code(503).send({ success: false });
			const { user } = await getAccountSession(auth, request);
			const token = await integration.store.getAccessToken(user.id);
			if (!token) return reply.code(403).send({ success: false });
			request.log.info("[Mixcloud Upload] receiving");
			directory = await mkdtemp(join(tmpdir(), "archive-mixcloud-upload-"));
			const upload = await receiveUpload(request, join(directory, "audio.mp3"));
			if (!upload) status = 400;
			else {
				request.log.info("[Mixcloud Upload] uploading to provider");
				const result = await integration.client.upload(token, upload);
				request.log.info(
					{
						providerStatus: result.providerStatus,
						responseBody: result.responseBody,
					},
					"[Mixcloud Upload] provider response",
				);
				status = result.statusCode;
				success = result.success;
			}
		} catch (error) {
			if (isMatching(P.instanceOf(AccountError), error))
				return sendFailure(error, request, reply);
			if (isMatching({ statusCode: 413 }, error)) {
				status = 413;
				request.log.warn(
					{ reason: "multipart_limit_exceeded" },
					"[Mixcloud Upload] rejected",
				);
			} else request.log.error("[Mixcloud Upload] receiving failed");
		} finally {
			// Finish cleanup before sending a response, including on invalid input or stream failure.
			if (directory !== undefined) {
				try {
					await rm(directory, { recursive: true, force: true });
					request.log.info("[Mixcloud Upload] temporary files removed");
				} catch {
					if (!success) status = 500;
					request.log.error("[Mixcloud Upload] temporary file cleanup failed");
				}
			}
		}
		request.log.info(
			{ statusCode: status, elapsedMs: Date.now() - startedAt },
			"[Mixcloud Upload] completed",
		);
		return reply.code(status).send({ success });
	};
