import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching, P } from "ts-pattern";
import type { TypedDatabase } from "../../../admin/routes/types.js";
import { AccountError, getAccountSession } from "../../../auth/access.js";
import {
	accountHeaders,
	requireAccountBody,
	sendAccountError,
	validatePassword,
} from "../../../auth/accounts.js";
import { type ArchiveAuth, createAuth } from "../../../auth/auth.js";
import {
	consumeAccountRateLimit,
	lockAccountManagement,
} from "../../../auth/security.js";
import type { ChangePasswordRoute } from "../types.js";
export const changePasswordHandler =
	(auth: ArchiveAuth, database: TypedDatabase) =>
	async (
		request: FastifyRequest<ChangePasswordRoute>,
		reply: FastifyReply<ChangePasswordRoute>,
	) => {
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
			return { success: true } as const;
		} catch (error) {
			return sendAccountError(error, request, reply);
		}
	};
