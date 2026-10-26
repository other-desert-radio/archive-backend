import type { FastifyReply, FastifyRequest } from "fastify";
import { AccountError } from "../../../auth/access.js";

export const sendFailure = (
	error: unknown,
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	if (error instanceof AccountError)
		return reply.code(error.status).send({
			error: error.message,
			...(error.code ? { code: error.code } : {}),
		});
	// Handle here so parent error hooks never receive database query parameters.
	request.log.error(`[Mixcloud] request failed -- reference: ${request.id}`);
	return reply
		.code(500)
		.send({ error: "Unable to access Mixcloud connection" });
};
