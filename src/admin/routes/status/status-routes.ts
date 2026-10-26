import type { FastifyPluginAsync } from "fastify";
import { getAdminStatusHandler } from "./routes/get-admin-status.js";

/** Registers the authenticated admin API status route. */
export const adminStatusRoutes: FastifyPluginAsync = async (app) => {
	app.get<{ Reply: { status: string } }>("/", getAdminStatusHandler);
};
