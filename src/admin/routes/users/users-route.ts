import type { FastifyPluginAsync } from "fastify";
import { isMatching } from "ts-pattern";
import { AccountError, accountAccessGuard } from "../../../auth/access.js";
import {
	accountHeaders,
	accountRolePattern,
	findManagedUser,
	mutateAccounts,
	normalizeAccountEmail,
	protectAdministrator,
	requireAccountBody,
	requireAccountId,
	safeUserColumns,
	sendAccountError,
	validatePassword,
} from "../../../auth/accounts.js";
import type { ArchiveAuth } from "../../../auth/auth.js";
import type { TypedDatabase } from "../types.js";
import type { UserSummary } from "./types.js";

type ManagementReply = {
	200: UserSummary | { id: string };
	201: UserSummary;
	400: { error: string };
	401: { error: string };
	403: { error: string };
	404: { error: string };
	409: { error: string };
	429: { error: string };
	500: { error: string };
};

/** Authenticated administrators manage accounts through serialized library calls. */
export const userRoutes =
	(auth: ArchiveAuth, database: TypedDatabase): FastifyPluginAsync =>
	async (app) => {
		app.addHook("onRequest", accountAccessGuard(auth, true));
		app.get<{ Reply: { 200: UserSummary[]; 500: { error: string } } }>(
			"/users",
			async (request, reply) => {
				try {
					const users = await database
						.selectFrom("user")
						.select(safeUserColumns)
						.orderBy("email")
						.execute();
					request.log.info(
						{ count: users.length },
						`[Accounts] accounts listed -- count: ${users.length}`,
					);
					return users;
				} catch (error) {
					return sendAccountError(error, request, reply);
				}
			},
		);
		app.post<{ Body: unknown; Reply: ManagementReply }>(
			"/create-user",
			async (request, reply) => {
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
			},
		);
		app.post<{ Body: unknown; Reply: ManagementReply }>(
			"/modify-user-role",
			async (request, reply) => {
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
			},
		);
		app.post<{ Body: unknown; Reply: ManagementReply }>(
			"/reset-user-password",
			async (request, reply) => {
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
			},
		);
		app.post<{ Body: unknown; Reply: ManagementReply }>(
			"/remove-user",
			async (request, reply) => {
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
			},
		);
	};
