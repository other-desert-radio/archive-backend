import type { FastifyReply, FastifyRequest } from "fastify";
import type {
	MixcloudRouteDependencies,
	PrepareUploadedShowRoute,
} from "../../types.js";

/** Pending record → client.getCloudcast → store snapshot → editorial/provider review.
 * Invalid ID → 400; missing upload → 404; already saved → 409;
 * unavailable integration → 503; fetch/validation failure → 502/504.
 * Scaffold is intentionally not registered on live routes.
 */
export const prepareUploadedShowHandler =
	(
		_database: MixcloudRouteDependencies["database"],
		_integration: MixcloudRouteDependencies["integration"],
	) =>
	async (
		_request: FastifyRequest<PrepareUploadedShowRoute>,
		_reply: FastifyReply<PrepareUploadedShowRoute>,
	): Promise<void> => {
		throw new Error("Not implemented: prepareUploadedShowHandler");
	};
