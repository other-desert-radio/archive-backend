import type { FastifyReply, FastifyRequest } from "fastify";
import { AccountError, getAccountSession } from "../../../../auth/access.js";
import { authOrigin } from "../../../../auth/auth.js";
import { MixcloudClientError } from "../../../../mixcloud/index.js";
import { sendFailure } from "../send-failure.js";
import type {
	MixcloudCallbackOutcome,
	MixcloudRouteDependencies,
} from "../types.js";

export const mixcloudCallbackHandler =
	(
		auth: MixcloudRouteDependencies["auth"],
		integration: MixcloudRouteDependencies["integration"],
	) =>
	async (request: FastifyRequest, reply: FastifyReply) => {
		const redirect = (outcome: MixcloudCallbackOutcome) =>
			reply.redirect(`/admin/?mixcloud=${outcome}#shows`, 303);
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
	};
