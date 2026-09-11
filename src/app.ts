import Fastify from "fastify";
import { adminRoutes } from "./admin/admin.js";

export const buildApp = () => {
	const app = Fastify({ logger: true });

	app.get("/health", async () => ({ status: "ok" }));
	app.register(adminRoutes);

	return app;
};
