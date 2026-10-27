import type { FastifyReply, FastifyRequest } from "fastify";
import type {
	MixcloudRouteDependencies,
	SaveUploadedShowRoute,
} from "../../types.js";

/** Validate editorial fields → saveReviewedUpload → persisted Show response.
 * Invalid input/DJs → 400; missing upload → 404; missing snapshot → 409;
 * transaction failure → 500; created → 201; replay → 200.
 * Scaffold is intentionally not registered on live routes.
 */
export const saveUploadedShowHandler =
	(_database: MixcloudRouteDependencies["database"]) =>
	async (
		_request: FastifyRequest<SaveUploadedShowRoute>,
		_reply: FastifyReply<SaveUploadedShowRoute>,
	): Promise<void> => {
		throw new Error("Not implemented: saveUploadedShowHandler");
	};
