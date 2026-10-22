import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { AccountError, getAccountSession } from "../../../auth/access.js";
import { authOrigin } from "../../../auth/auth.js";
import { MixcloudClientError } from "../../../mixcloud/index.js";
import type { AdminApiReply, ErrorResponse } from "../types.js";
import type {
	MixcloudCallbackOutcome,
	MixcloudConnectResponse,
	MixcloudDisconnectResponse,
	MixcloudRouteDependencies,
	MixcloudStatus,
} from "./types.js";

const sendFailure = (
	error: unknown,
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	if (error instanceof AccountError)
		return reply.code(error.status).send({
			error: error.message,
			...(error.code ? { code: error.code } : {}),
		});
	// Handle here so parent error hooks never receive database query parameters.
	request.log.error(`[Mixcloud] request failed -- reference: ${request.id}`);
	return reply
		.code(500)
		.send({ error: "Unable to access Mixcloud connection" });
};

/** Authenticated admin resource; register beneath the shared session/origin boundary. */
export const mixcloudRoutes =
	({ auth, integration }: MixcloudRouteDependencies): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", async (_request, reply) => {
			reply.header("cache-control", "no-store");
			reply.header("referrer-policy", "no-referrer");
		});
		app.get<{ Reply: AdminApiReply<MixcloudStatus> }>(
			"/mixcloud/status",
			async (request, reply) => {
				if (!integration) return { configured: false, connected: false };
				try {
					const { user } = await getAccountSession(auth, request);
					request.log.info("[Mixcloud Status] loading");
					const account = await integration.store.getConnection(user.id);
					request.log.info("[Mixcloud Status] loaded");
					return account
						? { configured: true, connected: true, account }
						: { configured: true, connected: false };
				} catch (error) {
					return sendFailure(error, request, reply);
				}
			},
		);
		app.post<{
			Reply: AdminApiReply<MixcloudConnectResponse> & { 503: ErrorResponse };
		}>("/mixcloud/connect", async (request, reply) => {
			if (!integration)
				return reply.code(503).send({ error: "Mixcloud is not configured" });
			try {
				const { user, session } = await getAccountSession(auth, request);
				request.log.info("[Mixcloud Connect] starting");
				const state = await integration.store.createAttempt({
					userId: user.id,
					sessionId: session.id,
				});
				const authorizationUrl = integration.client.authorizationUrl(state);
				request.log.info("[Mixcloud Connect] authorization ready");
				return { authorizationUrl };
			} catch (error) {
				return sendFailure(error, request, reply);
			}
		});
		app.get("/mixcloud/callback", async (request, reply) => {
			const redirect = (outcome: MixcloudCallbackOutcome) =>
				reply.redirect(`/admin/?mixcloud=${outcome}#upload`, 303);
			if (!integration) return redirect("unavailable");
			try {
				const { user, session } = await getAccountSession(auth, request);
				// Raw query preserves duplicate parameters for OAuth validation.
				const parameters = new URL(request.url, authOrigin).searchParams;
				const state = parameters.get("state");
				if (
					!state ||
					state.length > 1024 ||
					parameters.getAll("state").length !== 1
				)
					return redirect("invalid_attempt");
				request.log.info("[Mixcloud Callback] completing");
				const completed = await integration.store.completeAuthorization(
					{ userId: user.id, sessionId: session.id },
					state,
					async () => {
						const accessToken = await integration.client.exchangeCode(
							parameters,
							state,
						);
						const identity = await integration.client.getIdentity(accessToken);
						return { accessToken, identity };
					},
				);
				request.log.info(
					`[Mixcloud Callback] completed -- outcome: ${completed ? "connected" : "invalid_attempt"}`,
				);
				return redirect(completed ? "connected" : "invalid_attempt");
			} catch (error) {
				if (error instanceof AccountError)
					return sendFailure(error, request, reply);
				// Never redirect provider text, codes, tokens, or caller-supplied URLs.
				const denied =
					error instanceof MixcloudClientError &&
					error.code === "authorization_rejected" &&
					new URL(request.url, authOrigin).searchParams.get("error") ===
						"access_denied";
				request.log.warn(
					`[Mixcloud Callback] rejected -- outcome: ${denied ? "denied" : "failed"}, reference: ${request.id}`,
				);
				return redirect(denied ? "denied" : "failed");
			}
		});
		app.post<{
			Reply: AdminApiReply<MixcloudDisconnectResponse> & { 503: ErrorResponse };
		}>("/mixcloud/disconnect", async (request, reply) => {
			if (!integration)
				return reply.code(503).send({ error: "Mixcloud is not configured" });
			try {
				const { user } = await getAccountSession(auth, request);
				request.log.info("[Mixcloud Disconnect] disconnecting");
				await integration.store.disconnect(user.id);
				request.log.info("[Mixcloud Disconnect] disconnected");
				return { disconnected: true };
			} catch (error) {
				return sendFailure(error, request, reply);
			}
		});
	};
