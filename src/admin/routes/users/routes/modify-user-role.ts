import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { AccountError } from "../../../../auth/access.js";
import {
	accountHeaders,
	accountRolePattern,
	findManagedUser,
	mutateAccounts,
	protectAdministrator,
	requireAccountBody,
	requireAccountId,
	sendAccountError,
} from "../../../../auth/accounts.js";
import type { TypedDatabase } from "../../types.js";
import type { ModifyUserRoleRoute } from "../types.js";

export const modifyUserRoleHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<ModifyUserRoleRoute>,
		reply: FastifyReply<ModifyUserRoleRoute>,
	) => {
		try {
			const body = requireAccountBody(request.body);
			const id = requireAccountId(body.id);
			if (!isMatching(accountRolePattern, body.role))
				throw new AccountError(400, "Role must be admin or editor");
			const role = body.role;
			request.log.info(
				{ userId: id },
				`[Accounts] role change started -- id: ${id}`,
			);
			const user = await mutateAccounts(
				database,
				request,
				async (transaction, scopedAuth, actorId) => {
					const target = await findManagedUser(transaction, id);
					if (target.role === role) return target;
					if (role === "editor")
						await protectAdministrator(transaction, target, actorId);
					await scopedAuth.api.setRole({
						headers: accountHeaders(request),
						body: { userId: id, role },
					});
					await scopedAuth.api.revokeUserSessions({
						headers: accountHeaders(request),
						body: { userId: id },
					});
					return findManagedUser(transaction, id);
				},
			);
			request.log.info(
				{ userId: id },
				`[Accounts] role changed -- id: ${id}, role: ${role}`,
			);
			return user;
		} catch (error) {
			return sendAccountError(error, request, reply);
		}
	};
