import type { FastifyReply, FastifyRequest } from "fastify";
import type { UploadMixcloudRoute } from "../types.js";

/** Authenticated by the admin boundary; multipart and provider upload are pending. */
export const uploadMixcloudHandler = async (
	_request: FastifyRequest<UploadMixcloudRoute>,
	reply: FastifyReply<UploadMixcloudRoute>,
) => {
	return reply.code(501).send({ success: false });
};
