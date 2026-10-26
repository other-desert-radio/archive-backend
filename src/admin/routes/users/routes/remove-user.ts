import type { FastifyReply, FastifyRequest } from "fastify";
import {
	accountHeaders,
	findManagedUser,
	mutateAccounts,
	protectAdministrator,
	requireAccountBody,
	requireAccountId,
	sendAccountError,
} from "../../../../auth/accounts.js";
import type { TypedDatabase } from "../../types.js";
import type { RemoveUserRoute } from "../types.js";

export const removeUserHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<RemoveUserRoute>,
		reply: FastifyReply<RemoveUserRoute>,
	) => {
		try {
			const id = requireAccountId(requireAccountBody(request.body).id);
			request.log.info(
				{ userId: id },
				`[Accounts] account deletion started -- id: ${id}`,
			);
			await mutateAccounts(
				database,
				request,
				async (transaction, scopedAuth, actorId) => {
					const target = await findManagedUser(transaction, id);
					await protectAdministrator(transaction, target, actorId);
					await scopedAuth.api.removeUser({
						headers: accountHeaders(request),
						body: { userId: id },
					});
				},
			);
			request.log.info(
				{ userId: id },
				`[Accounts] account deleted -- id: ${id}`,
			);
			return { id };
		} catch (error) {
			return sendAccountError(error, request, reply);
		}
	};
