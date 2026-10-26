import type { FastifyReply, FastifyRequest } from "fastify";
import { AccountError } from "../../../../auth/access.js";
import {
	accountHeaders,
	findManagedUser,
	mutateAccounts,
	requireAccountBody,
	requireAccountId,
	sendAccountError,
	validatePassword,
} from "../../../../auth/accounts.js";
import type { TypedDatabase } from "../../types.js";
import type { ResetUserPasswordRoute } from "../types.js";

export const resetUserPasswordHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ResetUserPasswordRoute>,
		reply: FastifyReply<ResetUserPasswordRoute>,
	) => {
		try {
			const body = requireAccountBody(request.body);
			const id = requireAccountId(body.id);
			const password = validatePassword(body.password);
			request.log.info(
				{ userId: id },
				`[Accounts] password reset started -- id: ${id}`,
			);
			const user = await mutateAccounts(
				database,
				request,
				async (transaction, scopedAuth, actorId) => {
					if (id === actorId)
						throw new AccountError(
							400,
							"Use change password with your current password for your own account",
						);
					await findManagedUser(transaction, id);
					await scopedAuth.api.setUserPassword({
						headers: accountHeaders(request),
						body: { userId: id, newPassword: password },
					});
					await transaction
						.updateTable("user")
						.set({ mustChangePassword: true, updatedAt: new Date() })
						.where("id", "=", id)
						.execute();
					await scopedAuth.api.revokeUserSessions({
						headers: accountHeaders(request),
						body: { userId: id },
					});
					return findManagedUser(transaction, id);
				},
			);
			request.log.info(
				{ userId: id },
				`[Accounts] password reset completed -- id: ${id}`,
			);
			return user;
		} catch (error) {
			return sendAccountError(error, request, reply);
		}
	};
