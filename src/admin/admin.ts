import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { auth } from "../auth/auth.js";
import { db as defaultDb } from "../db/db.js";
import { djRoutes } from "./routes/djs/index.js";
import { showRoutes } from "./routes/shows/index.js";
import { adminStatusRoutes } from "./routes/status.js";
import { tagRoutes } from "./routes/tags/index.js";
import type { ErrorResponse, TypedDatabase } from "./routes/types.js";

export type { TypedDatabase } from "./routes/types.js";

type BetterAuth = typeof auth;

type AdminUiRoute = {
	Params: { "*"?: string };
	Reply: {
		200: Buffer;
		404: ErrorResponse;
		503: ErrorResponse;
	};
};

export type BasicAuthCredentials = {
	username: string;
	password: string;
};

const defaultBasicAuthCredentials: BasicAuthCredentials = {
	username: process.env.ADMIN_BASIC_USERNAME ?? "",
	password: process.env.ADMIN_BASIC_PASSWORD ?? "",
};

const hasValidBasicAuth = (
	authorization: string | undefined,
	credentials: BasicAuthCredentials,
): boolean => {
	if (!authorization?.startsWith("Basic ")) {
		return false;
	}

	const decoded = Buffer.from(authorization.slice(6), "base64").toString(
		"utf8",
	);
	const separator = decoded.indexOf(":");

	return (
		separator !== -1 &&
		decoded.slice(0, separator) === credentials.username &&
		decoded.slice(separator + 1) === credentials.password &&
		credentials.username !== "" &&
		credentials.password !== ""
	);
};

const requireAuthenticatedAdminAccess = (
	auth: BetterAuth,
	credentials: BasicAuthCredentials,
) => {
	return async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		if (hasValidBasicAuth(request.headers.authorization, credentials)) {
			return;
		}

		const session = await auth.api.getSession({
			headers: fromNodeHeaders(request.headers),
		});

		if (!session?.user) {
			reply
				.header(
					"WWW-Authenticate",
					'Basic realm="Archive Admin", charset="UTF-8"',
				)
				.code(401)
				.send({ error: "Unauthorized" });
			reply.hijack();
			return;
		}

		if (session.user.role !== "admin") {
			reply.code(403).send({ error: "Forbidden" });
			reply.hijack();
			return;
		}
	};
};

/**
 * Registers the authenticated admin API and UI routes.
 *
 * The `/api/admin/*` and `/admin/*` routes are protected by the hook below.
 * Public routes, including `/health`, are registered outside this function.
 */
const adminApiRoutes = (database: TypedDatabase): FastifyPluginAsync => {
	return async (app) => {
		await app.register(adminStatusRoutes);
		await app.register(djRoutes(database));
		await app.register(showRoutes(database));
		await app.register(tagRoutes(database));
	};
};

/** Registers authenticated admin UI asset routes. */
const adminUiRoutes: FastifyPluginAsync = async (app) => {
	const adminUiRoot = resolve(process.cwd(), "dist/admin");

	const serveAdminFile = async (
		request: FastifyRequest,
		reply: FastifyReply,
	) => {
		const wildcard = (request.params as { "*"?: string })["*"];
		const relativePath = wildcard || "index.html";
		const filePath = resolve(adminUiRoot, relativePath);

		if (
			filePath !== adminUiRoot &&
			!filePath.startsWith(`${adminUiRoot}${sep}`)
		) {
			return reply.code(404).send({ error: "Not Found" });
		}

		try {
			const file = await readFile(filePath);
			return reply.type(contentTypeFor(filePath)).send(file);
		} catch (error) {
			request.log.error(error, "Unable to load admin UI asset");
			return reply.code(wildcard ? 404 : 503).send({
				error: wildcard ? "Not Found" : "Admin UI is unavailable",
			});
		}
	};

	app.get<AdminUiRoute>("/", serveAdminFile);
	app.get<AdminUiRoute>("/*", serveAdminFile);
};

const contentTypeFor = (filePath: string): string => {
	switch (extname(filePath)) {
		case ".css":
			return "text/css";
		case ".js":
			return "application/javascript";
		case ".svg":
			return "image/svg+xml";
		case ".json":
			return "application/json";
		default:
			return "text/html";
	}
};
/**
 * Registers the authenticated admin boundary.
 *
 * Both `/api/admin/*` and `/admin/*` require an admin session or configured
 * temporary Basic Auth credentials. This function does not register public
 * routes; `/health` is registered separately in the application.
 */
export const adminRoutes = (
	auth: BetterAuth,
	database: TypedDatabase = defaultDb,
	credentials: BasicAuthCredentials = defaultBasicAuthCredentials,
): FastifyPluginAsync => {
	return async (app) => {
		app.addHook(
			"onRequest",
			requireAuthenticatedAdminAccess(auth, credentials),
		);
		await app.register(adminApiRoutes(database), { prefix: "/api/admin" });
		await app.register(adminUiRoutes, { prefix: "/admin" });
	};
};
