import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { Kysely } from "kysely";
import type { auth } from "../auth/auth.js";
import { db as defaultDb } from "../db/db.js";
import type { Database } from "../db/types.js";
import { transformDJs } from "../json-transformers/index.js";

type BetterAuth = typeof auth;

type AdminDatabase = Kysely<Database>;

const requireAuthenticatedAdminAccess = (auth: BetterAuth) => {
	return async (
		request: FastifyRequest,
		reply: FastifyReply,
	): Promise<void> => {
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(request.headers),
		});

		if (!session?.user) {
			reply.code(401).send({ error: "Unauthorized" });
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

const adminApiRoutes = (database: AdminDatabase): FastifyPluginAsync => {
	return async (app) => {
		app.get("/", async () => ({ status: "admin api boundary ready" }));

		app.get("/djs", async (request, reply) => {
			try {
				const [djs, showDJs, djTags, showTags] = await Promise.all([
					database
						.selectFrom("djs")
						.select(["id", "title", "bio", "image"])
						.orderBy("id")
						.execute(),
					database
						.selectFrom("show_djs")
						.select(["dj_id", "show_id"])
						.orderBy("dj_id")
						.orderBy("show_id")
						.execute(),
					database
						.selectFrom("dj_tags")
						.select(["dj_id", "tag_id"])
						.orderBy("dj_id")
						.orderBy("tag_id")
						.execute(),
					database
						.selectFrom("show_djs")
						.innerJoin("show_tags", "show_tags.show_id", "show_djs.show_id")
						.select(["show_djs.dj_id", "show_tags.tag_id"])
						.orderBy("show_djs.dj_id")
						.orderBy("show_tags.tag_id")
						.execute(),
				]);

				return transformDJs({ djs, showDJs, djTags, showTags });
			} catch (error) {
				request.log.error(error, "Unable to load DJs");
				return reply.code(500).send({ error: "Internal Server Error" });
			}
		});
	};
};

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

	app.get("/", serveAdminFile);
	app.get("/*", serveAdminFile);
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

export const adminRoutes = (
	auth: BetterAuth,
	database: AdminDatabase = defaultDb,
): FastifyPluginAsync => {
	return async (app) => {
		app.addHook("onRequest", requireAuthenticatedAdminAccess(auth));
		await app.register(adminApiRoutes(database), { prefix: "/api/admin" });
		await app.register(adminUiRoutes, { prefix: "/admin" });
	};
};
