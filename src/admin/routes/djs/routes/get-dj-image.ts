import type { FastifyReply, FastifyRequest } from "fastify";
import type { TypedDatabase } from "../../types.js";
import { serveDJImage } from "../serve-dj-image.js";
import type { GetDJImageRoute } from "../types.js";

export const getDJImageHandler =
	(database: TypedDatabase) =>
	(
		request: FastifyRequest<GetDJImageRoute>,
		reply: FastifyReply<GetDJImageRoute>,
	) =>
		serveDJImage(
			database,
			request.params.id,
			request.params.variant,
			request,
			reply,
		);
