import type { FastifyReply, FastifyRequest } from "fastify";
import type { TypedDatabase } from "../../types.js";
import type { GetShowImageRoute } from "../types.js";

export const getShowImageHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<GetShowImageRoute>,
		reply: FastifyReply<GetShowImageRoute>,
	) => {
		const id = Number(request.params.id);
		const { variant } = request.params;
		if (
			!Number.isSafeInteger(id) ||
			id < 1 ||
			(variant !== "small" && variant !== "large")
		)
			return reply.code(404).send({ error: "Not Found" });
		try {
			const column = variant === "small" ? "image_small" : "image_large";
			const show = await database
				.selectFrom("shows")
				.select(column)
				.where("id", "=", id)
				.executeTakeFirst();
			const image = show?.[column];
			if (image === null || image === undefined)
				return reply.code(404).send({ error: "Not Found" });
			return reply.type("image/webp").code(200).send(image);
		} catch (error) {
			request.log.error(error, "Unable to load Show image");
			return reply.code(500).send({ error: "Internal Server Error" });
		}
	};
