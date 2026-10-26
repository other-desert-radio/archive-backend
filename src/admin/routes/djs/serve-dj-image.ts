import type { FastifyReply, FastifyRequest } from "fastify";
import type { TypedDatabase } from "../types.js";
export const serveDJImage = async (
	database: TypedDatabase,
	id: string,
	variant: string,
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	const numericId = Number(id);
	if (!Number.isSafeInteger(numericId) || numericId < 1)
		return reply.code(404).send({ error: "Not Found" });
	if (variant !== "small" && variant !== "large")
		return reply.code(404).send({ error: "Not Found" });

	try {
		const dj = await database
			.selectFrom("djs")
			.select(variant === "small" ? ["image_small"] : ["image_large"])
			.where("id", "=", numericId)
			.executeTakeFirst();
		const image = variant === "small" ? dj?.image_small : dj?.image_large;
		if (image === null || image === undefined)
			return reply.code(404).send({ error: "Not Found" });

		reply.type("image/webp");
		return reply.code(200).send(image);
	} catch (error) {
		request.log.error(error, "Unable to load DJ image");
		return reply.code(500).send({ error: "Internal Server Error" });
	}
};
