import Fastify from "fastify";
import { adminRoutes } from "./admin/admin.js";
import type { auth } from "./auth/auth.js";
import { authRoutes } from "./auth/routes.js";

type BetterAuth = typeof auth;

export const buildApp = (auth: BetterAuth) => {
	const app = Fastify({ logger: true });

	app.get("/health", async () => ({ status: "ok" }));
	app.register(adminRoutes(auth));
	app.register(authRoutes(auth));

	return app;
};
