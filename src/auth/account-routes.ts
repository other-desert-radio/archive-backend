import type { FastifyPluginAsync } from "fastify";
import { isMatching, P } from "ts-pattern";
import type { TypedDatabase } from "../admin/routes/types.js";
import { AccountError, getAccountSession } from "./access.js";
import {
	accountHeaders,
	requireAccountBody,
	sendAccountError,
	validatePassword,
} from "./accounts.js";
import { type ArchiveAuth, createAuth } from "./auth.js";
import {
	consumeAccountRateLimit,
	lockAccountManagement,
	requireSameOrigin,
} from "./security.js";

/** Signed-in accounts may replace their own password, including temporary ones. */
export const accountRoutes =
	(auth: ArchiveAuth, database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", requireSameOrigin);
		app.post<{
			Body: unknown;
			Reply: {
				200: { success: boolean };
				400: { error: string };
				401: { error: string };
				403: { error: string };
				429: { error: string };
				500: { error: string };
			};
		}>("/api/account/change-password", async (request, reply) => {
			try {
				const session = await getAccountSession(auth, request, true);
				const body = requireAccountBody(request.body);
				if (!isMatching(P.string.minLength(1), body.currentPassword))
					throw new AccountError(400, "Current password is required");
				const currentPassword = body.currentPassword;
				const newPassword = validatePassword(body.newPassword);
				// Better Auth's password verifier normalizes Unicode with NFKC.
				if (newPassword.normalize("NFKC") === currentPassword.normalize("NFKC"))
					throw new AccountError(400, "Choose a different password");
				if (!(await consumeAccountRateLimit(database, request.ip)))
					throw new AccountError(
						429,
						"Too many password requests. Please try again shortly",
					);
				request.log.info(
					{ userId: session.user.id },
					`[Accounts] own password change started -- id: ${session.user.id}`,
				);
				const cookies = await database
					.transaction()
					.execute(async (transaction) => {
						await lockAccountManagement(transaction);
						const scopedAuth = createAuth(transaction);
						const current = await getAccountSession(scopedAuth, request, true);
						const response = await scopedAuth.api.changePassword({
							headers: accountHeaders(request),
							body: { currentPassword, newPassword, revokeOtherSessions: true },
							asResponse: true,
						});
						if (!response.ok) {
							const result: unknown = await response.json();
							const invalid = isMatching({ code: "INVALID_PASSWORD" }, result);
							throw new AccountError(
								400,
								invalid
									? "Current password is incorrect"
									: "Password change was rejected",
							);
						}
						await transaction
							.updateTable("user")
							.set({ mustChangePassword: false, updatedAt: new Date() })
							.where("id", "=", current.user.id)
							.execute();
						return response.headers.getSetCookie();
					});
				if (cookies.length) reply.header("set-cookie", cookies);
				request.log.info(
					{ userId: session.user.id },
					`[Accounts] own password changed -- id: ${session.user.id}`,
				);
				return { success: true };
			} catch (error) {
				return sendAccountError(error, request, reply);
			}
		});
	};
