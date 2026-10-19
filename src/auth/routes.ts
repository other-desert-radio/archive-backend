import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync } from "fastify";
import { authOrigin } from "./auth.js";
import { requireSameOrigin } from "./security.js";

type AuthHandler = { handler: (request: Request) => Promise<Response> };
const publicEndpoints = new Map([
	["/api/auth/sign-in/email", "POST"],
	["/api/auth/get-session", "GET"],
	["/api/auth/sign-out", "POST"],
]);

/** Only sign-in, session and sign-out are exposed; mutations use guarded APIs. */
export const authRoutes =
	(auth: AuthHandler): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", requireSameOrigin);
		app.route({
			method: ["GET", "POST"],
			url: "/api/auth/*",
			async handler(request, reply) {
				const pathname = new URL(request.url, authOrigin).pathname;
				if (publicEndpoints.get(pathname) !== request.method)
					return reply.code(404).send({ error: "Not Found" });
				try {
					const headers = fromNodeHeaders(request.headers);
					headers.delete("x-forwarded-for");
					headers.delete("x-real-ip");
					headers.set("x-archive-client-ip", request.ip);
					const init: RequestInit = { method: request.method, headers };
					if (request.body !== undefined)
						init.body = JSON.stringify(request.body);
					request.log.info(
						`[Authentication] request started -- endpoint: ${pathname}`,
					);
					const response = await auth.handler(
						new Request(new URL(pathname, authOrigin), init),
					);
					response.headers.forEach((value, key) => {
						if (key !== "set-cookie") reply.header(key, value);
					});
					const cookies = response.headers.getSetCookie();
					if (cookies.length) reply.header("set-cookie", cookies);
					request.log[response.ok ? "info" : "warn"](
						`[Authentication] request completed -- endpoint: ${pathname}, status: ${response.status}`,
					);
					return reply
						.code(response.status)
						.send(response.body ? await response.text() : null);
				} catch (error: unknown) {
					request.log.error({ err: error }, "[Authentication] request failed");
					return reply
						.code(500)
						.send({ error: "Internal authentication error" });
				}
			},
		});
	};
