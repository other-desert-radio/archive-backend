import type { FastifyPluginAsync } from "fastify";
import { healthHandler } from "./routes/get-health.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
	app.get("/health", healthHandler);
};
