import type { FastifyReply, FastifyRequest } from "fastify";
import type {
	GetPendingUploadsRoute,
	MixcloudRouteDependencies,
} from "../../types.js";

/** Shared archive queue; listing never contacts Mixcloud or exposes account credentials. */
export const getPendingUploadsHandler =
	(database: MixcloudRouteDependencies["database"]) =>
	async (
		request: FastifyRequest<GetPendingUploadsRoute>,
		reply: FastifyReply<GetPendingUploadsRoute>,
	) => {
		try {
			const uploads = await database
				.selectFrom("mixcloud_uploads")
				.select(["id", "title", "date", "mixcloud_key"])
				.where("show_id", "is", null)
				.orderBy("id", "desc")
				.execute();
			return reply.code(200).send(
				uploads.map((upload) => ({
					uploadId: upload.id,
					title: upload.title,
					date: upload.date.toISOString().slice(0, 10),
					key: upload.mixcloud_key,
					url: `https://www.mixcloud.com${upload.mixcloud_key}`,
				})),
			);
		} catch {
			request.log.error(
				"[Mixcloud Uploads] pending uploads could not be loaded",
			);
			return reply.code(500).send({ error: "Unable to load pending uploads" });
		}
	};
