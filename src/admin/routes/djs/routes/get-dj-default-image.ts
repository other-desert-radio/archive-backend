import type { FastifyReply, FastifyRequest } from "fastify";
import type { TypedDatabase } from "../../types.js";
import { serveDJImage } from "../serve-dj-image.js";
import type { GetDJDefaultImageRoute } from "../types.js";

export const getDJDefaultImageHandler =
	(database: TypedDatabase) =>
	(
		request: FastifyRequest<GetDJDefaultImageRoute>,
		reply: FastifyReply<GetDJDefaultImageRoute>,
	) =>
		serveDJImage(database, request.params.id, "large", request, reply);
