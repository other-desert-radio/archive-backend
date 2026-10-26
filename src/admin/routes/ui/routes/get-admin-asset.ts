import type { FastifyReply, FastifyRequest } from "fastify";
import { serveAdminFile } from "../serve-admin-file.js";
import type { AdminUiRoute } from "../types.js";
export const getAdminAssetHandler =
	(adminUiRoot: string) =>
	(request: FastifyRequest<AdminUiRoute>, reply: FastifyReply<AdminUiRoute>) =>
		serveAdminFile(adminUiRoot, request, reply);
