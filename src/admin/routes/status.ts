import type { FastifyPluginAsync } from "fastify";

/** Registers the authenticated admin API status route. */
export const adminStatusRoutes: FastifyPluginAsync = async (app) => {
	app.get<{ Reply: { status: string } }>("/", async () => ({
		status: "admin api boundary ready",
	}));
};
