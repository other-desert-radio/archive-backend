import { fromNodeHeaders } from "better-auth/node";
import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import { authOrigin } from "../../../auth/auth.js";
import type { AuthHandler } from "../types.js";

const publicEndpoints = new Map([
	["/api/auth/sign-in/email", "POST"],
	["/api/auth/get-session", "GET"],
	["/api/auth/sign-out", "POST"],
]);
export const authProxyHandler =
	(auth: AuthHandler) =>
	async (request: FastifyRequest, reply: FastifyReply) => {
		reply.header("x-request-id", request.id);
		const pathname = new URL(request.url, authOrigin).pathname;
		if (publicEndpoints.get(pathname) !== request.method)
			return reply.code(404).send({ error: "Not Found" });
		try {
			const headers = fromNodeHeaders(request.headers);
			headers.delete("x-forwarded-for");
			headers.delete("x-real-ip");
			headers.set("x-archive-client-ip", request.ip);
			const init: RequestInit = { method: request.method, headers };
			if (request.body !== undefined) init.body = JSON.stringify(request.body);
			request.log.info(
				`[Authentication] request started -- endpoint: ${pathname}`,
			);
			const response = await auth.handler(
				new Request(new URL(pathname, authOrigin), init),
			);
			response.headers.forEach((value, key) => {
				if (key !== "set-cookie" && key !== "x-request-id")
					reply.header(key, value);
			});
			const cookies = response.headers.getSetCookie();
			if (cookies.length) reply.header("set-cookie", cookies);
			request.log[
				response.status >= 500 ? "error" : response.ok ? "info" : "warn"
			](
				`[Authentication] request completed -- endpoint: ${pathname}, status: ${response.status}, reference: ${request.id}${response.status >= 500 ? "; check authentication/database configuration and applied migrations" : ""}`,
			);
			if (pathname === "/api/auth/sign-in/email" && !response.ok) {
				let errorCode: string | undefined;
				try {
					const body: unknown = await response.clone().json();
					if (isMatching({ code: P.string.regex(/^[A-Z0-9_]{1,64}$/) }, body))
						errorCode = body.code;
				} catch {
					// Keep the auth response private; status remains useful for diagnosis.
				}
				request.log.warn(
					`[Authentication] sign-in rejected -- status: ${response.status}${errorCode ? `, code: ${errorCode}` : ""}, reference: ${request.id}`,
				);
			}
			return reply
				.code(response.status)
				.send(response.body ? await response.text() : null);
		} catch (error: unknown) {
			request.log.error(
				{ err: error },
				`[Authentication] request failed -- endpoint: ${pathname}, reference: ${request.id}`,
			);
			return reply.code(500).send({ error: "Internal authentication error" });
		}
	};
