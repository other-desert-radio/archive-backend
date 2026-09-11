import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";

type AuthHandler = {
	handler: (request: Request) => Promise<Response>;
};

const firstHeaderValue = (
	value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

export const authRoutes = (auth: AuthHandler): FastifyPluginAsync => {
	return async (app) => {
		app.route({
			method: ["GET", "POST"],
			url: "/api/auth/*",
			async handler(request, reply) {
				try {
					const protocol =
						firstHeaderValue(request.headers["x-forwarded-proto"]) ?? "http";
					const host = request.headers.host ?? "localhost";
					const url = new URL(request.url, `${protocol}://${host}`);
					const headers = fromNodeHeaders(request.headers);
					const init: RequestInit = { method: request.method, headers };

					if (request.body !== undefined) {
						init.body = JSON.stringify(request.body);
					}

					const response = await auth.handler(new Request(url, init));
					response.headers.forEach((value, key) => {
						reply.header(key, value);
					});

					return reply
						.code(response.status)
						.send(response.body ? await response.text() : null);
				} catch (error: unknown) {
					app.log.error(error, "Authentication handler failed");
					return reply
						.code(500)
						.send({ error: "Internal authentication error" });
				}
			},
		});
	};
};
