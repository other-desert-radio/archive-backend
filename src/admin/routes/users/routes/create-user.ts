import type { FastifyReply, FastifyRequest } from "fastify";
import { isMatching } from "ts-pattern";
import { AccountError } from "../../../../auth/access.js";
import {
	accountHeaders,
	accountRolePattern,
	findManagedUser,
	mutateAccounts,
	normalizeAccountEmail,
	requireAccountBody,
	sendAccountError,
	validatePassword,
} from "../../../../auth/accounts.js";
import type { TypedDatabase } from "../../types.js";
import type { CreateUserRoute } from "../types.js";

export const createUserHandler =
	(database: TypedDatabase) =>
	async (
		request: FastifyRequest<CreateUserRoute>,
		reply: FastifyReply<CreateUserRoute>,
	) => {
		try {
			const body = requireAccountBody(request.body);
			const email = normalizeAccountEmail(body.email);
			const password = validatePassword(body.password);
			if (!isMatching(accountRolePattern, body.role))
				throw new AccountError(400, "Role must be admin or editor");
			const role = body.role;
			request.log.info("[Accounts] account creation started");
			const user = await mutateAccounts(
				database,
				request,
				async (transaction, scopedAuth) => {
					const created = await scopedAuth.api.createUser({
						headers: accountHeaders(request),
						body: {
							email,
							password,
							name: email,
							role,
							data: { mustChangePassword: true },
						},
					});
					return findManagedUser(transaction, created.user.id);
				},
			);
			request.log.info(
				{ userId: user.id },
				`[Accounts] account created -- id: ${user.id}, role: ${user.role}`,
			);
			return reply.code(201).send(user);
		} catch (error) {
			return sendAccountError(error, request, reply);
		}
	};
