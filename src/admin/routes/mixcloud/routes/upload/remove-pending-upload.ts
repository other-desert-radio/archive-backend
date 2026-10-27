import type { FastifyReply, FastifyRequest } from "fastify";
import type {
	MixcloudRouteDependencies,
	RemovePendingUploadRoute,
} from "../../types.js";

/** Delete only an unsaved draft; never delete a Show or contact Mixcloud. */
export const removePendingUploadHandler =
	(database: MixcloudRouteDependencies["database"]) =>
	async (
		request: FastifyRequest<RemovePendingUploadRoute>,
		reply: FastifyReply<RemovePendingUploadRoute>,
	) => {
		const uploadId = Number(request.params.id);
		if (
			!/^[1-9]\d*$/.test(request.params.id) ||
			!Number.isSafeInteger(uploadId)
		)
			return reply.code(400).send({ error: "Invalid upload ID" });
		try {
			const removed = await database
				.deleteFrom("mixcloud_uploads")
				.where("id", "=", uploadId)
				.where("show_id", "is", null)
				.returning("id")
				.executeTakeFirst();
			if (!removed) {
				const existing = await database
					.selectFrom("mixcloud_uploads")
					.select("id")
					.where("id", "=", uploadId)
					.executeTakeFirst();
				if (existing)
					return reply
						.code(409)
						.send({ error: "This upload has already been saved" });
				return reply.code(404).send({ error: "Upload not found" });
			}
			request.log.info(
				{ uploadId },
				"[Mixcloud Uploads] pending record removed; provider upload unchanged",
			);
			return reply.code(200).send({ uploadId });
		} catch {
			request.log.error(
				{ uploadId },
				"[Mixcloud Uploads] pending record could not be removed",
			);
			return reply.code(500).send({ error: "Unable to remove pending upload" });
		}
	};
